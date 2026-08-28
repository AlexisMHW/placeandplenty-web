// Every URL Supabase Auth is allowed to redirect back to, in one place.
//
// WHY THIS FILE EXISTS. Supabase rejects any `redirectTo` that is not on
// the project's allowlist, and the failure is quiet and confusing: the
// email still sends, the link still looks right, and clicking it drops
// the person on the Site URL with no session and no explanation. That is
// indistinguishable from an expired link, so it gets misdiagnosed as one.
//
// Keeping the list here means the set of URLs the code actually uses can
// be read off in one place and pasted into the dashboard, rather than
// reconstructed by grepping for `emailRedirectTo`.
//
// FOUNDER ACTION — Supabase dashboard, Authentication -> URL
// Configuration. Both entries below must be present under "Redirect
// URLs", and the Site URL should be https://placeandplenty.com:
//
//     https://placeandplenty.com/auth/callback
//     http://localhost:3000/auth/callback
//
// A single wildcard entry (https://placeandplenty.com/**) also works and
// is what Vercel preview deployments need, but the explicit pair is
// tighter and is what production should run on.
//
// EVERYTHING GOES THROUGH /auth/callback. Magic link, password recovery
// and any future OAuth provider all land there and are then forwarded to
// the right page via `next`. One allowlisted URL instead of one per
// flow — fewer dashboard entries to get wrong, and one place where the
// open-redirect guard on `next` is enforced.
//
// MOBILE / DEEP LINKS. The native app has its own scheme
// (`placeandplenty`) and its own recovery handling; a reset requested in
// the app redirects there, not here. The AASA deliberately claims only
// `/invite/*`, so a recovery link opened on a phone opens the BROWSER
// rather than the app — which is correct, because the reset page below
// is mobile-first and works without an install. Do not add
// `/reset-password` to the AASA unless and until a confirmed native
// recovery screen exists; claiming a path the app cannot handle sends
// people into a dead end, the same reasoning that keeps `/gallery/*`
// unclaimed.

/** Where every auth email comes back to. Must be allowlisted. */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Where a recovery link forwards to once its code has been exchanged. */
export const RESET_PASSWORD_PATH = "/reset-password";

/**
 * Absolute callback URL for the current origin.
 *
 * Built from the live origin rather than a constant so localhost,
 * Vercel previews and production each request their own — a hardcoded
 * production URL would send a developer's reset email to production.
 */
export function callbackUrl(origin: string, next: string): string {
  return `${origin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

/**
 * Reject anything that is not a same-site path.
 *
 * `next` reaches us from a URL a stranger can craft. A scheme, or the
 * protocol-relative "//evil.example", would turn our own auth callback
 * into an open redirect that hands over a freshly minted session.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/host";
  if (!next.startsWith("/") || next.startsWith("//")) return "/host";
  return next;
}
