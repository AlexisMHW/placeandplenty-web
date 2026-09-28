import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.PAYMENT_PROCESSOR_SECRET_KEY?.trim() || "";
  const sessionId = "cs_test_a1jFvZwA5V7XP8rJ8PzoMbVaTGOrsyRAmHJsqiWKfGMItki988AWzYR1BU";
  if (!key) return NextResponse.json({ ok:false, error:"stripe_not_configured" }, { status:500 });

  const [response, accountResponse] = await Promise.all([
    fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(sessionId), {
    headers: { Authorization: "Bearer " + key },
      cache: "no-store",
    }),
    fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: "Bearer " + key },
      cache: "no-store",
    }),
  ]);
  const body = await response.json();
  const account = await accountResponse.json();
  if (!response.ok) return NextResponse.json({ ok:false, status:response.status, body }, { status:502 });

  return NextResponse.json({
    ok:true,
    id:body.id,
    payment_status:body.payment_status,
    status:body.status,
    amount_total:body.amount_total,
    currency:body.currency,
    payment_intent:body.payment_intent,
    metadata:body.metadata,
    mode:body.mode,
    livemode:body.livemode,
    stripe_account_id:account.id ?? null,
    stripe_account_email:account.email ?? null,
  });
}
