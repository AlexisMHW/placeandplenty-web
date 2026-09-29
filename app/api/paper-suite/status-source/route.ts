import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient, getUser as getCookieUser } from "@/lib/supabase-server";
import { getGelatoOrder } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, unknown>;

function record(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateValue(value: unknown) {
  const valueText = textValue(value);
  return valueText && /^\d{4}-\d{2}-\d{2}/.test(valueText)
    ? valueText.slice(0, 10)
    : null;
}

function httpsUrl(value: unknown) {
  const valueText = textValue(value);
  if (!valueText) return null;
  try {
    const url = new URL(valueText);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function canonicalStatus(providerStatus: string | null) {
  const status = (providerStatus || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (["delivered"].includes(status)) return "delivered";
  if (["shipped", "in_transit", "intransit"].includes(status)) return "shipped";
  if (
    ["in_production", "production", "printed", "ready_for_shipping", "ready_to_ship"].includes(status)
  ) {
    return "in_production";
  }
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (["failed", "rejected", "refused"].includes(status)) return "failed";
  return "submitted";
}

function normalizeGelatoOrder(order: AnyRecord) {
  const shipment = record(order.shipment);
  const packages = Array.isArray(shipment?.packages)
    ? shipment!.packages.map(record).filter(Boolean) as AnyRecord[]
    : [];

  const firstPackage = packages[0] || null;
  const providerStatus =
    textValue(order.fulfillmentStatus) ||
    textValue(shipment?.status) ||
    textValue(firstPackage?.status);

  const trackingNumber =
    textValue(firstPackage?.trackingNumber) ||
    textValue(firstPackage?.trackingCode) ||
    textValue(firstPackage?.trackingId) ||
    textValue(firstPackage?.parcelTrackingCode);

  const trackingUrl =
    httpsUrl(firstPackage?.trackingUrl) ||
    httpsUrl(firstPackage?.trackingURL) ||
    httpsUrl(firstPackage?.trackingLink) ||
    httpsUrl(firstPackage?.url);

  const carrier =
    textValue(firstPackage?.carrierName) ||
    textValue(firstPackage?.carrier) ||
    textValue(shipment?.carrierName) ||
    textValue(shipment?.shipmentMethodName);

  return {
    providerStatus,
    canonicalStatus: canonicalStatus(providerStatus),
    carrier,
    trackingNumber,
    trackingUrl,
    estimatedDeliveryMin:
      dateValue(shipment?.minDeliveryDate) || dateValue(shipment?.initialMinDeliveryDate),
    estimatedDeliveryMax:
      dateValue(shipment?.maxDeliveryDate) || dateValue(shipment?.initialMaxDeliveryDate),
  };
}

async function authContext(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
    const { data: { user } } = await client.auth.getUser(token);
    return { user, client };
  }

  const user = await getCookieUser();
  return { user, client: createCookieClient() };
}

export async function POST(req: NextRequest) {
  const { user, client } = await authContext(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { orderId?: string } | null;
  if (!body?.orderId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: order, error } = await client
    .from("paper_orders")
    .select("id,user_id,status,gelato_order_id,gelato_order_type")
    .eq("id", body.orderId)
    .maybeSingle();

  if (error || !order || order.user_id !== user.id) {
    return NextResponse.json({ error: "paper_order_not_found" }, { status: 404 });
  }
  if (!order.gelato_order_id) {
    return NextResponse.json({ error: "paper_order_not_submitted" }, { status: 409 });
  }

  try {
    const gelato = await getGelatoOrder(String(order.gelato_order_id));
    const normalized = normalizeGelatoOrder(gelato as AnyRecord);

    return NextResponse.json({
      orderId: order.id,
      orderType: order.gelato_order_type,
      currentStatus: order.status,
      ...normalized,
    });
  } catch (error) {
    console.error("Paper Suite Gelato status lookup failed", error);
    return NextResponse.json({ error: "gelato_status_lookup_failed" }, { status: 502 });
  }
}
