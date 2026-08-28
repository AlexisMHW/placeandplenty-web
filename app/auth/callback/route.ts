import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext, RESET_PASSWORD_PATH } from "@/lib/auth-redirects";

// Exchanges a magic-link, OAuth or password-recovery code for a session.
//
// A Route Handler rather than a page because it must SET cookies, which
// Server Components cannot do. This is the one place a session is
// written on sign-in, and the single URL that needs allowlisting in the
// Supabase dashboard — see lib/auth-redirects.ts.
//
// FAILURES ARE ROUTED TO WHERE THEY CAN BE FIXED. An expired link is the
// most common real failure, and the right response depends on what the
// person was trying to do: someone recovering a password needs the
// "request a new link" form, not a login page that asks for the password
// they have forgotten. So the error follows `next` rather than always
// landing on /login.
//
// The open-redirect guard on `next` lives in safeNext() and is shared
// with LoginForm, so both cannot drift apart.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Supabase reports link-level problems on the redirect itself —
  // an already-used link, or one that expired before it was opened.
  const authError = searchParams.get("error");
  const isRecovery = next.startsWith(RESET_PASSWORD_PATH);
  const failure = (reason: string) =>
    NextResponse.redirect(
      isRecovery
        ? `${origin}${RESET_PASSWORD_PATH}?error=${reason}`
        : `${origin}/login?error=${reason}`
    );

  if (authError) return failure("link_expired");
  if (!code) return failure("missing_code");

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  // A recovery code is single-use and short-lived. Exchange failing is
  // overwhelmingly "they opened it twice" or "it sat in an inbox too
  // long" — both recoverable, neither worth an error page.
  if (error) return failure("link_expired");

  return NextResponse.redirect(`${origin}${next}`);
}
