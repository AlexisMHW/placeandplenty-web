import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase-server";
import { findWebProduct } from "@/lib/checkout";

export const runtime = "nodejs";

const MULTI_DAY_TEST_PRICE_IDS = {
  standard: "price_1UI8WY36TUbcLA5LzBxKiyTg",
  gathering_pass: "price_1UI8YD36TUbcLA5Lr5tWOE4i",
  plus: "price_1UI8YF36TUbcLA5LyAcJBVOL",
  extension: "price_1UI8YJ36TUbcLA5LBtE91Kj3",
} as const;

function configuredStripePrice(
  envValue: string | undefined,
  testFallback: string
): string | undefined {
  if (envValue) return envValue;

  // Price IDs are not secrets, but sandbox IDs must never leak into a live
  // checkout. Use the committed fallback only when the configured Stripe
  // secret is explicitly a test-mode key.
  const key = process.env.PAYMENT_PROCESSOR_SECRET_KEY;
  if (key?.startsWith("sk_test_")) return testFallback;

  return undefined;
}

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

  // Never sell an entitlement the account/gathering already owns.
  if (product.canonicalProductId === "plus_annual") {
    const { data: hasPlus, error } = await supabase.rpc("user_has_plus");
    if (error) return NextResponse.json({ error: "entitlement_check_failed" }, { status: 500 });
    if (hasPlus === true) {
      return NextResponse.redirect(new URL("/host/account?billing=already-owned", siteUrl()), 303);
    }
  } else if (gatheringId && product.canonicalProductId === "gathering_pass") {
    const { data: premium, error } = await supabase.rpc("resolve_gathering_is_premium", {
      p_gathering_id: gatheringId,
    });
    if (error) return NextResponse.json({ error: "gathering_check_failed" }, { status: 400 });
    if (premium === true) {
      return NextResponse.redirect(new URL("/host?billing=already-unlocked", siteUrl()), 303);
    }
  } else if (gatheringId && product.canonicalProductId === "multi_day_pass") {
    const { data: hasMultiDay, error } = await supabase.rpc("gathering_has_multi_day_access", {
      p_gathering_id: gatheringId,
    });
    if (error) return NextResponse.json({ error: "multi_day_check_failed" }, { status: 400 });
    if (hasMultiDay === true) {
      return NextResponse.redirect(new URL(`/host/g/${gatheringId}/schedule?billing=already-owned`, siteUrl()), 303);
    }
  } else if (gatheringId && product.canonicalProductId === "multi_day_extension") {
    const { data: hasExtension, error } = await supabase.rpc("gathering_has_multi_day_extension", {
      p_gathering_id: gatheringId,
    });
    if (error) return NextResponse.json({ error: "multi_day_extension_check_failed" }, { status: 400 });
    if (hasExtension === true) {
      return NextResponse.redirect(new URL(`/host/g/${gatheringId}/schedule?billing=extension-owned`, siteUrl()), 303);
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

  let priceId: string | undefined;
  if (product.canonicalProductId === "plus_annual") {
    priceId = process.env.STRIPE_PLUS_ANNUAL_PRICE_ID;
  } else if (product.canonicalProductId === "gathering_pass") {
    priceId = process.env.STRIPE_GATHERING_PASS_PRICE_ID;
  } else if (product.canonicalProductId === "multi_day_extension") {
    priceId = configuredStripePrice(
      process.env.STRIPE_MULTI_DAY_EXTENSION_PRICE_ID,
      MULTI_DAY_TEST_PRICE_IDS.extension
    );
  } else {
    const { data: tier, error: tierError } = await supabase.rpc("resolve_multi_day_purchase_tier", {
      p_gathering_id: gatheringId,
    });
    if (tierError || !["standard", "gathering_pass", "plus"].includes(String(tier))) {
      return NextResponse.json({ error: "multi_day_tier_failed" }, { status: 400 });
    }
    priceId =
      tier === "plus"
        ? configuredStripePrice(
            process.env.STRIPE_MULTI_DAY_PLUS_PRICE_ID,
            MULTI_DAY_TEST_PRICE_IDS.plus
          )
        : tier === "gathering_pass"
          ? configuredStripePrice(
              process.env.STRIPE_MULTI_DAY_GATHERING_PASS_PRICE_ID,
              MULTI_DAY_TEST_PRICE_IDS.gathering_pass
            )
          : configuredStripePrice(
              process.env.STRIPE_MULTI_DAY_STANDARD_PRICE_ID,
              MULTI_DAY_TEST_PRICE_IDS.standard
            );
  }

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
  stripe.set("automatic_tax[enabled]", "true");

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
