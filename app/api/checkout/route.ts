import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase-server";
import { findWebProduct } from "@/lib/checkout";

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

async function createStripeCheckoutSession(params: URLSearchParams) {
  const key = process.env.PAYMENT_PROCESSOR_SECRET_KEY;
  if (!key) throw new Error("stripe_not_configured");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
    console.error("Stripe checkout session creation failed", body.error?.message || response.status);
    throw new Error("stripe_session_failed");
  }
  return body.url;
}

export async function POST(req: NextRequest) {
  if (!safeSameOrigin(req)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", siteUrl()), 303);
  }

  const form = await req.formData();
  const slug = String(form.get("product") || "");
  const gatheringId = String(form.get("gatheringId") || "") || null;
  const product = findWebProduct(slug);
  if (!product) return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  if (product.requiresGathering && !gatheringId) {
    return NextResponse.json({ error: "gathering_required" }, { status: 400 });
  }

  const supabase = createClient();

  // Never sell an entitlement the account already owns.
  if (product.canonicalProductId === "plus_annual") {
    const { data: hasPlus, error } = await supabase.rpc("user_has_plus");
    if (error) return NextResponse.json({ error: "entitlement_check_failed" }, { status: 500 });
    if (hasPlus === true) {
      return NextResponse.redirect(new URL("/host/account?billing=already-owned", siteUrl()), 303);
    }
  } else if (gatheringId) {
    const { data: premium, error } = await supabase.rpc("resolve_gathering_is_premium", {
      p_gathering_id: gatheringId,
    });
    if (error) return NextResponse.json({ error: "gathering_check_failed" }, { status: 400 });
    if (premium === true) {
      return NextResponse.redirect(new URL("/host?billing=already-unlocked", siteUrl()), 303);
    }
  }

  // The canonical purchase intent exists BEFORE Stripe can charge. For a
  // Gathering Pass this is what binds the future verified transaction to
  // exactly one gathering. The RPC also verifies gathering membership.
  const { data: purchaseIntentId, error: intentError } = await supabase.rpc("create_purchase_intent", {
    p_canonical_product_id: product.canonicalProductId,
    p_gathering_id: gatheringId,
  });
  if (intentError || !purchaseIntentId) {
    console.error("Could not create purchase intent", intentError?.message);
    return NextResponse.json({ error: "purchase_intent_failed" }, { status: 400 });
  }

  const priceId =
    product.canonicalProductId === "plus_annual"
      ? process.env.STRIPE_PLUS_ANNUAL_PRICE_ID
      : process.env.STRIPE_GATHERING_PASS_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "stripe_price_not_configured" }, { status: 503 });
  }

  const mode = product.canonicalProductId === "plus_annual" ? "subscription" : "payment";
  const success = `${siteUrl()}/host/account?purchase=success`;
  const cancel = `${siteUrl()}/checkout/${product.slug}?purchase=cancelled`;

  const stripe = new URLSearchParams();
  stripe.set("mode", mode);
  stripe.set("line_items[0][price]", priceId);
  stripe.set("line_items[0][quantity]", "1");
  stripe.set("success_url", success);
  stripe.set("cancel_url", cancel);
  stripe.set("client_reference_id", user.id);
  if (user.email) stripe.set("customer_email", user.email);
  stripe.set("allow_promotion_codes", "false");

  stripe.set("metadata[user_id]", user.id);
  stripe.set("metadata[canonical_product_id]", product.canonicalProductId);
  stripe.set("metadata[purchase_intent_id]", String(purchaseIntentId));
  if (gatheringId) stripe.set("metadata[gathering_id]", gatheringId);

  // Put the same provenance on the resulting PaymentIntent or Subscription,
  // which makes support and refund reconciliation possible without guessing.
  const target = mode === "subscription" ? "subscription_data" : "payment_intent_data";
  stripe.set(`${target}[metadata][user_id]`, user.id);
  stripe.set(`${target}[metadata][canonical_product_id]`, product.canonicalProductId);
  stripe.set(`${target}[metadata][purchase_intent_id]`, String(purchaseIntentId));
  if (gatheringId) stripe.set(`${target}[metadata][gathering_id]`, gatheringId);

  try {
    const url = await createStripeCheckoutSession(stripe);
    return NextResponse.redirect(url, 303);
  } catch {
    return NextResponse.redirect(new URL(`/checkout/${product.slug}?purchase=error`, siteUrl()), 303);
  }
}
