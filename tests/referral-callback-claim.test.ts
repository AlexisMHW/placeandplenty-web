import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claimReferralFromCookie } from "../lib/claimReferral.ts";
import { buildCookieValue } from "../lib/referral.ts";

// WS5: the referral claim must run for BOTH ways a signup confirmation can reach /auth/callback (PKCE `code` and branded `token_hash`),
// never for password recovery, and stay inert behind NEXT_PUBLIC_HC_REFERRALS. Static checks on the route plus behaviour of the claim itself.
const route = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");

describe("auth callback referral claim wiring", () => {
  test("one helper, gated by the HC referrals flag, swallows every error", () => {
    assert.equal((route.match(/async function claimReferralIfAny/g) ?? []).length, 1);
    assert.match(route, /process\.env\.NEXT_PUBLIC_HC_REFERRALS !== "true"\) return;/);
    assert.match(route, /catch \{\s*\/\* attribution must never affect sign-in \*\//);
  });
  test("the helper is called after the PKCE code exchange AND after token_hash verification", () => {
    const afterVerify = route.slice(route.indexOf("verifyOtp"), route.indexOf("exchangeCodeForSession"));
    assert.match(afterVerify, /claimReferralIfAny\(request, supabase, tokenResponse\)/);
    assert.match(route.slice(route.indexOf("exchangeCodeForSession")), /claimReferralIfAny\(request, supabase, response\)/);
  });
  test("password recovery never claims a referral", () => {
    assert.match(route, /if \(type !== "recovery"\) await claimReferralIfAny/);
  });
  test("the cookie is cleared only on a definitive answer", () => {
    assert.match(route, /if \(result\.clear\) response\.cookies\.set\(REFERRAL_COOKIE, ""/);
  });
});

describe("claimReferralFromCookie", () => {
  const now = Date.now();
  const cookie = buildCookieValue({ code: "jane-smith", touchedAt: now - 1000 });
  test("definitive database answers clear the cookie; transient errors keep it", async () => {
    for (const status of ["claimed", "self_referral", "existing_customer", "claim_too_late", "invalid_code"]) {
      const r = await claimReferralFromCookie(cookie, async () => ({ data: { status }, error: null }), now);
      assert.equal(r.clear, true, status);
    }
    const err = await claimReferralFromCookie(cookie, async () => ({ data: null, error: { message: "x" } }), now);
    assert.equal(err.clear, false);
  });
  test("an absent or expired cookie never calls the database", async () => {
    let calls = 0;
    const rpc = async () => { calls++; return { data: { status: "claimed" }, error: null }; };
    await claimReferralFromCookie(undefined, rpc, now);
    await claimReferralFromCookie(buildCookieValue({ code: "jane-smith", touchedAt: now - 31 * 86_400_000 }), rpc, now);
    assert.equal(calls, 0);
  });
});
