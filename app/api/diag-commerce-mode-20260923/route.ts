import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stripe = process.env.PAYMENT_PROCESSOR_SECRET_KEY?.trim() || "";
  return NextResponse.json({
    stripeConfigured: Boolean(stripe),
    stripeMode: stripe.startsWith("sk_test_") ? "test" : stripe.startsWith("sk_live_") ? "live" : stripe ? "unknown" : "missing",
    gelatoConfigured: Boolean(process.env.GELATO_API_KEY),
    paperLiveFulfillmentEnabled:
      process.env.PAPER_SUITE_FULFILLMENT_ENABLED?.toLowerCase() === "true",
    paperRetailMarkupConfigured: Boolean(process.env.PAPER_SUITE_MARKUP_PERCENT),
  });
}
