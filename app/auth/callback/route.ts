import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext, RESET_PASSWORD_PATH } from "@/lib/auth-redirects";

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
        : `${origin}/login?error=${reason}`
    );

  if (authError) return failure("link_expired");
  if (!code && !tokenHash) return failure("missing_code");

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
    // Branded recovery emails use token_hash so the email can point at the
    // Place & Plenty callback directly. Recovery is the only supported type
    // here for token-hash verification; other auth flows continue to use PKCE.
    if (type !== "recovery") return failure("invalid_type");

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (error) return failure("link_expired");
    return NextResponse.redirect(`${origin}${RESET_PASSWORD_PATH}`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code!);
  if (error) return failure("link_expired");

  return NextResponse.redirect(`${origin}${next}`);
}
