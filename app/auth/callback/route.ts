import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext, isTokenHashType, COMPLETE_PATH, RESET_PASSWORD_PATH } from "@/lib/auth-redirects";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { claimReferralFromCookie } from "@/lib/claimReferral";

// Exchanges a magic-link, OAuth or password-recovery credential for a session.
//
// Supabase can return either a PKCE `code` or an email-template `token_hash`.
// Supporting both keeps the recovery flow reliable across branded auth emails
// without changing any account, entitlement, or product behavior.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const authError = searchParams.get("error");
  const isRecovery = next.startsWith(RESET_PASSWORD_PATH) || type === "recovery";
  const failure = (reason: string) =>
    NextResponse.redirect(
      isRecovery
        ? `${origin}${RESET_PASSWORD_PATH}?error=${reason}`
        : `${origin}/login?error=${reason}&next=${encodeURIComponent(next)}`
    );

  if (authError) return failure("link_expired");
  if (!code && !tokenHash) {
    // Links requested from the native app use the implicit flow: the session (or the error) is in the URL FRAGMENT, which a server
    // never sees. Browsers keep the fragment across a redirect, so hand the link to the client page that can read it. It sends the
    // person to the same failure screens below when the fragment is missing or reports a dead link.
    const forward = new URL(`${origin}${COMPLETE_PATH}`);
    forward.searchParams.set("next", next);
    if (isRecovery) forward.searchParams.set("recovery", "1");
    return NextResponse.redirect(forward.toString());
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  if (tokenHash) {
    // Branded auth emails use token_hash so the email can point at the Place & Plenty callback directly. Only a known set of
    // types is verified (recovery, signup/email confirmation, magic link, invite, email change); anything else is refused.
    if (!isTokenHashType(type)) return failure("invalid_type");

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error) return failure("link_expired");
    return NextResponse.redirect(`${origin}${type === "recovery" ? RESET_PASSWORD_PATH : next}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) return failure("link_expired");

  const response = NextResponse.redirect(`${origin}${next}`);
  // Hosting Collective referral claim. Inert unless NEXT_PUBLIC_HC_REFERRALS === "true". It can never block or change a sign-in: any
  // failure is swallowed, the outcome is never shown to the user, and the database decides everything (first touch, window, self-referral).
  if (process.env.NEXT_PUBLIC_HC_REFERRALS === "true") {
    try {
      const cookie = request.cookies.get(REFERRAL_COOKIE)?.value;
      if (cookie) {
        const result = await claimReferralFromCookie(cookie, (fn, args) => supabase.rpc(fn, args) as unknown as Promise<{ data: unknown; error: unknown }>);
        if (result.clear) response.cookies.set(REFERRAL_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
      }
    } catch {
      /* attribution must never affect sign-in */
    }
  }
  return response;
}
