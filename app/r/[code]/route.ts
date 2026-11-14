// /r/[code]: sets a first-party, first-touch referral cookie and redirects to the home page.
// - INERT unless NEXT_PUBLIC_HC_REFERRALS === "true" (no cookie, plain redirect), so shipping the code changes nothing until the owner switches it on.
// - Honours Global Privacy Control (Sec-GPC: 1): no cookie is set.
// - No third-party calls, no personal data in the cookie (only the creator's public code and a timestamp), httpOnly, secure, SameSite=Lax, 30 days.
// - First touch wins: an existing unexpired cookie is never overwritten.
// COUNSEL REVIEW NEEDED before enabling: cookie disclosure on the privacy page, and whether a consent prompt is required in some regions.
import { NextRequest, NextResponse } from "next/server";
import { REFERRAL_COOKIE, buildCookieValue, cookieMaxAgeSeconds, nextTouch } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const res = NextResponse.redirect(new URL("/", req.url), 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  if (process.env.NEXT_PUBLIC_HC_REFERRALS !== "true") return res;
  if (req.headers.get("sec-gpc") === "1") return res;
  const touch = nextTouch(req.cookies.get(REFERRAL_COOKIE)?.value, params.code);
  if (touch) {
    res.cookies.set(REFERRAL_COOKIE, buildCookieValue(touch), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: cookieMaxAgeSeconds() });
  }
  return res;
}
