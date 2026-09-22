import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase-server";
import { getGathering } from "@/lib/host-data";
import { paperPiece, paperSize, type PaperPieceKind, type PaperSizeId } from "@/lib/paper-suite-catalog";
import { quoteGelatoOrder, type GelatoQuoteRequest } from "@/lib/gelato";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";
import { paperRetailPrice } from "@/lib/paper-suite-pricing";

export const runtime = "nodejs";

type CheckoutBody = {
  gatheringId?: string;
  kind?: PaperPieceKind;
  size?: PaperSizeId;
  template?: string;
  productUid?: string;
  quantity?: number;
  fileUrl?: string;
  recipient?: GelatoQuoteRequest["recipient"];
};

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

function validPrintUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const file = new URL(value);
    const site = new URL(siteUrl());
    return (
      file.protocol === "https:" &&
      file.origin === site.origin &&
      file.pathname === "/api/paper-suite/print/render"
    );
  } catch {
    return false;
  }
}

function validRecipient(recipient: CheckoutBody["recipient"]): recipient is GelatoQuoteRequest["recipient"] {
  if (!recipient) return false;
  return Boolean(
    recipient.country?.trim() &&
      recipient.firstName?.trim() &&
      recipient.lastName?.trim() &&
      recipient.addressLine1?.trim() &&
      recipient.city?.trim() &&
      recipient.postCode?.trim() &&
      recipient.email?.trim()
  );
}

async function stripeForm(path: string, params: URLSearchParams) {
  const key = process.env.PAYMENT_PROCESSOR_SECRET_KEY;
  if (!key) throw new Error("stripe_not_configured");

  const response = await fetch("https://api.stripe.com/v1/" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const body = (await response.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    console.error("Paper Suite Stripe request failed", body.error?.message || response.status);
    throw new Error("stripe_request_failed");
  }

  return body;
}

async function createStripeCustomer(
  userId: string,
  recipient: GelatoQuoteRequest["recipient"]
): Promise<string> {
  const params = new URLSearchParams();
  params.set("email", recipient.email);
  params.set("name", [recipient.firstName, recipient.lastName].filter(Boolean).join(" "));
  params.set("metadata[user_id]", userId);
  params.set("metadata[source]", "paper_suite");

  params.set("shipping[name]", [recipient.firstName, recipient.lastName].filter(Boolean).join(" "));
  params.set("shipping[address][line1]", recipient.addressLine1);
  if (recipient.addressLine2) params.set("shipping[address][line2]", recipient.addressLine2);
  params.set("shipping[address][city]", recipient.city);
  if (recipient.state) params.set("shipping[address][state]", recipient.state);
  params.set("shipping[address][postal_code]", recipient.postCode);
  params.set("shipping[address][country]", recipient.country);
  if (recipient.phone) params.set("shipping[phone]", recipient.phone);

  // Also save the shipping address as the Customer address so Checkout has
  // a complete tax location even when it doesn't ask the buyer to re-enter it.
  params.set("address[line1]", recipient.addressLine1);
  if (recipient.addressLine2) params.set("address[line2]", recipient.addressLine2);
  params.set("address[city]", recipient.city);
  if (recipient.state) params.set("address[state]", recipient.state);
  params.set("address[postal_code]", recipient.postCode);
  params.set("address[country]", recipient.country);

  const customer = await stripeForm("customers", params);
  if (!customer.id) throw new Error("stripe_customer_failed");
  return customer.id;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  if (
    !body?.gatheringId ||
    !body.kind ||
    !body.size ||
    !body.template ||
    !body.productUid ||
    !validPrintUrl(body.fileUrl) ||
    !validRecipient(body.recipient)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const piece = paperPiece(body.kind);
  const size = paperSize(body.size);
  if (!piece || !size || !piece.sizes.includes(body.size)) {
    return NextResponse.json({ error: "unsupported_piece_size" }, { status: 400 });
  }

  const gathering = await getGathering(body.gatheringId);
  if (!gathering) {
    return NextResponse.json({ error: "gathering_not_found" }, { status: 404 });
  }

  const quantity = Math.max(1, Math.min(Number(body.quantity) || 1, 500));
  const orderReferenceId = "paper-" + crypto.randomUUID();

  try {
    const rawQuote = await quoteGelatoOrder({
      orderReferenceId,
      customerReferenceId: user.id,
      currency: "USD",
      allowMultipleQuotes: false,
      recipient: body.recipient,
      products: [
        {
          itemReferenceId: orderReferenceId + "-item-1",
          productUid: body.productUid,
          quantity,
          files: [{ type: "default", url: body.fileUrl }],
        },
      ],
    });

    const normalized = normalizeGelatoQuote(rawQuote);
    if (normalized.currency !== "USD") {
      return NextResponse.json({ error: "unsupported_quote_currency" }, { status: 400 });
    }

    let retail;
    try {
      retail = paperRetailPrice(normalized.gelatoCostCents);
    } catch (error) {
      if (error instanceof Error && error.message === "paper_suite_pricing_not_configured") {
        return NextResponse.json({ error: "paper_suite_pricing_not_configured" }, { status: 503 });
      }
      throw error;
    }

    const supabase = createClient();
    const { data: order, error: orderError } = await supabase
      .from("paper_orders")
      .insert({
        user_id: user.id,
        gathering_id: body.gatheringId,
        piece_type: body.kind,
        size_id: body.size,
        template_id: body.template,
        product_uid: body.productUid,
        quantity,
        currency: "USD",
        print_file_url: body.fileUrl,
        print_file_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        shipping_address: body.recipient,
        shipment_method_uid: normalized.shipmentMethodUid,
        gelato_quote: rawQuote,
        gelato_cost_cents: normalized.gelatoCostCents,
        retail_subtotal_cents: retail.retailSubtotalCents,
        order_reference_id: orderReferenceId,
      })
      .select("id")
      .single();

    if (orderError || !order?.id) {
      console.error("Paper order intent insert failed", orderError?.message);
      return NextResponse.json({ error: "paper_order_create_failed" }, { status: 400 });
    }

    const customerId = await createStripeCustomer(user.id, body.recipient);
    const session = new URLSearchParams();
    session.set("mode", "payment");
    session.set("customer", customerId);
    session.set("automatic_tax[enabled]", "true");
    session.set("billing_address_collection", "auto");
    session.set("allow_promotion_codes", "false");

    session.set("line_items[0][quantity]", "1");
    session.set("line_items[0][price_data][currency]", "usd");
    session.set(
      "line_items[0][price_data][unit_amount]",
      String(retail.retailSubtotalCents)
    );
    session.set(
      "line_items[0][price_data][product_data][name]",
      "Place & Plenty " + piece.label
    );
    session.set(
      "line_items[0][price_data][product_data][description]",
      size.label + " · " + quantity + (quantity === 1 ? " copy" : " copies")
    );

    const success =
      siteUrl() +
      "/host/g/" +
      encodeURIComponent(body.gatheringId) +
      "/paper-suite?paper_order=success&order_id=" +
      encodeURIComponent(String(order.id)) +
      "&session_id={CHECKOUT_SESSION_ID}";
    const cancel =
      siteUrl() +
      "/host/g/" +
      encodeURIComponent(body.gatheringId) +
      "/paper-suite?paper_order=cancelled&order_id=" +
      encodeURIComponent(String(order.id));

    session.set("success_url", success);
    session.set("cancel_url", cancel);

    session.set("metadata[flow]", "paper_suite");
    session.set("metadata[paper_order_id]", String(order.id));
    session.set("metadata[user_id]", user.id);
    session.set("metadata[gathering_id]", body.gatheringId);
    session.set("metadata[order_reference_id]", orderReferenceId);

    session.set("payment_intent_data[metadata][flow]", "paper_suite");
    session.set("payment_intent_data[metadata][paper_order_id]", String(order.id));
    session.set("payment_intent_data[metadata][user_id]", user.id);
    session.set("payment_intent_data[metadata][gathering_id]", body.gatheringId);
    session.set("payment_intent_data[metadata][order_reference_id]", orderReferenceId);

    const checkout = await stripeForm("checkout/sessions", session);
    if (!checkout.url || !checkout.id) throw new Error("stripe_session_failed");

    const { error: checkoutStateError } = await supabase.rpc(
      "mark_my_paper_order_checkout_pending",
      {
        p_order_id: order.id,
        p_stripe_checkout_session_id: checkout.id,
      }
    );
    if (checkoutStateError) {
      console.error("Could not mark Paper Suite checkout pending", checkoutStateError.message);
    }

    return NextResponse.json({
      url: checkout.url,
      orderId: order.id,
      price: {
        currency: "USD",
        retailSubtotalCents: retail.retailSubtotalCents,
        gelatoCostCents: normalized.gelatoCostCents,
        marginCents: retail.marginCents,
        testModeAtCost: retail.testModeAtCost,
      },
      deliveryLabel: normalized.deliveryLabel,
    });
  } catch (error) {
    console.error("Paper Suite checkout failed", error);
    return NextResponse.json({ error: "paper_suite_checkout_failed" }, { status: 502 });
  }
}
