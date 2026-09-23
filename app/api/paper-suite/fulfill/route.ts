import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase-server";
import {
  createGelatoOrder,
  GelatoApiError,
  type GelatoCreateOrderRequest,
  type GelatoRecipient,
} from "@/lib/gelato";

export const runtime = "nodejs";

function stripeSecret() {
  return process.env.PAYMENT_PROCESSOR_SECRET_KEY?.trim() || "";
}

async function retrieveCheckoutSession(sessionId: string) {
  const key = stripeSecret();
  if (!key) throw new Error("stripe_not_configured");

  const response = await fetch(
    "https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId),
    {
      headers: { Authorization: "Bearer " + key },
      cache: "no-store",
    }
  );

  const body = (await response.json()) as {
    id?: string;
    payment_status?: string;
    metadata?: Record<string, string>;
    error?: { message?: string };
  };

  if (!response.ok) {
    console.error("Paper Suite checkout verification failed", body.error?.message || response.status);
    throw new Error("stripe_session_lookup_failed");
  }

  return body;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { orderId?: string; sessionId?: string }
    | null;

  if (!body?.orderId || !body.sessionId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: order, error } = await supabase
    .from("paper_orders")
    .select(
      "id,user_id,gathering_id,status,product_uid,quantity,currency,print_file_url,shipping_address,shipment_method_uid,order_reference_id,gelato_order_id,gelato_order_type"
    )
    .eq("id", body.orderId)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "paper_order_not_found" }, { status: 404 });
  }

  if (order.gelato_order_id) {
    return NextResponse.json({
      fulfilled: true,
      gelatoOrderId: order.gelato_order_id,
      orderType: order.gelato_order_type,
      alreadySubmitted: true,
    });
  }

  const session = await retrieveCheckoutSession(body.sessionId).catch(() => null);
  if (
    !session ||
    session.payment_status !== "paid" ||
    session.metadata?.flow !== "paper_suite" ||
    session.metadata?.paper_order_id !== order.id ||
    session.metadata?.user_id !== user.id
  ) {
    return NextResponse.json({ error: "payment_not_verified" }, { status: 409 });
  }

  // The webhook is the canonical payment-state writer. If it has not reached
  // Supabase yet, don't race it by starting fulfillment from the return page.
  if (order.status !== "paid") {
    return NextResponse.json({ error: "payment_processing" }, { status: 409 });
  }

  const isStripeTest = stripeSecret().startsWith("sk_test_");
  const liveFulfillmentEnabled =
    process.env.PAPER_SUITE_FULFILLMENT_ENABLED?.toLowerCase() === "true";

  if (!isStripeTest && !liveFulfillmentEnabled) {
    return NextResponse.json({ error: "live_fulfillment_not_enabled" }, { status: 503 });
  }

  const recipient = order.shipping_address as GelatoRecipient;
  const gelatoOrderType: GelatoCreateOrderRequest["orderType"] = isStripeTest ? "draft" : "order";

  // Atomically reserve this paid order before calling Gelato. This closes
  // the race where two return-page requests could otherwise create two
  // external print orders before either one records its Gelato id.
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_my_paper_order_fulfillment",
    { p_order_id: order.id }
  );

  if (claimError) {
    console.error("Paper order fulfillment claim failed", claimError.message);
    return NextResponse.json({ error: "fulfillment_claim_failed" }, { status: 500 });
  }

  if (claimed !== true) {
    const { data: current } = await supabase
      .from("paper_orders")
      .select("status,gelato_order_id,gelato_order_type")
      .eq("id", order.id)
      .maybeSingle();

    if (current?.gelato_order_id) {
      return NextResponse.json({
        fulfilled: true,
        gelatoOrderId: current.gelato_order_id,
        orderType: current.gelato_order_type,
        alreadySubmitted: true,
      });
    }

    if (current?.status === "fulfilling" || current?.status === "submitted") {
      return NextResponse.json({ error: "fulfillment_processing" }, { status: 409 });
    }

    return NextResponse.json({ error: "fulfillment_not_claimed" }, { status: 409 });
  }

  try {
    const created = await createGelatoOrder({
      orderType: gelatoOrderType,
      orderReferenceId: String(order.order_reference_id),
      customerReferenceId: user.id,
      currency: String(order.currency || "USD"),
      items: [
        {
          itemReferenceId: String(order.order_reference_id) + "-item-1",
          productUid: String(order.product_uid),
          quantity: Number(order.quantity),
          files: [{ type: "default", url: String(order.print_file_url) }],
        },
      ],
      shippingAddress: recipient,
      shipmentMethodUid: order.shipment_method_uid
        ? String(order.shipment_method_uid)
        : undefined,
      metadata: [
        { key: "paper_order_id", value: String(order.id) },
        { key: "gathering_id", value: String(order.gathering_id) },
        { key: "source", value: "place_and_plenty" },
      ],
    });

    const gelatoOrderId =
      typeof created.id === "string"
        ? created.id
        : typeof created.orderId === "string"
          ? created.orderId
          : null;

    if (!gelatoOrderId) {
      console.error("Gelato order response missing id", created);
      return NextResponse.json({ error: "gelato_order_id_missing" }, { status: 502 });
    }

    const { data: marked, error: markError } = await supabase.rpc(
      "mark_my_paper_order_submitted",
      {
        p_order_id: order.id,
        p_gelato_order_id: gelatoOrderId,
        p_gelato_order_type: gelatoOrderType,
      }
    );

    if (markError || marked !== true) {
      console.error("Paper order submission record failed", markError?.message);
      return NextResponse.json(
        { error: "paper_order_submission_record_failed", gelatoOrderId },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fulfilled: true,
      gelatoOrderId,
      orderType: gelatoOrderType,
      draft: gelatoOrderType === "draft",
    });
  } catch (fulfillmentError) {
    console.error("Gelato Paper Suite fulfillment failed", fulfillmentError);

    // Only release the claim for a definite client/request rejection.
    // For network failures or provider 5xx responses we keep the order
    // claimed so a blind browser retry cannot accidentally duplicate a
    // Gelato order whose response was lost.
    if (
      fulfillmentError instanceof GelatoApiError &&
      fulfillmentError.status >= 400 &&
      fulfillmentError.status < 500
    ) {
      await supabase.rpc("release_my_paper_order_fulfillment", {
        p_order_id: order.id,
        p_failure_reason: "gelato_rejected_" + fulfillmentError.status,
      });
    }

    return NextResponse.json(
      {
        error:
          fulfillmentError instanceof GelatoApiError &&
          fulfillmentError.status >= 400 &&
          fulfillmentError.status < 500
            ? "gelato_fulfillment_rejected"
            : "gelato_fulfillment_needs_reconciliation",
      },
      { status: 502 }
    );
  }
}
