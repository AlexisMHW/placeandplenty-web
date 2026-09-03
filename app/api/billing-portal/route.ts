import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getMyEntitlements } from "@/lib/entitlement-data";
import { isLive } from "@/lib/entitlements";

export const runtime = "nodejs";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

function safeSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(siteUrl()).origin;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!safeSameOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", siteUrl()), 303);

  const entitlements = await getMyEntitlements();
  const webPlus = entitlements.find(
    (e) =>
      isLive(e) &&
      e.provider === "web" &&
      e.scope === "account" &&
      e.entitlement_type === "plus" &&
      Boolean(e.provider_customer_id)
  );

  if (!webPlus?.provider_customer_id) {
    return NextResponse.redirect(new URL("/host/account?billing=not-web-managed", siteUrl()), 303);
  }

  const key = process.env.PAYMENT_PROCESSOR_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const params = new URLSearchParams();
  params.set("customer", webPlus.provider_customer_id);
  params.set(
    "return_url",
    process.env.STRIPE_BILLING_PORTAL_RETURN_URL || `${siteUrl()}/host/account`
  );

  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const body = (await response.json()) as { url?: string; error?: { message?: string } };
  if (!response.ok || !body.url) {
    console.error("Stripe billing portal creation failed", body.error?.message || response.status);
    return NextResponse.redirect(new URL("/host/account?billing=portal-error", siteUrl()), 303);
  }

  return NextResponse.redirect(body.url, 303);
}
