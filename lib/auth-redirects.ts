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
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020]/.test(next)) return "/host";
  try {
    const parsed = new URL(next, "https://placeandplenty.com");
    if (parsed.origin !== "https://placeandplenty.com" || ["/login", "/signup", "/auth/callback"].includes(parsed.pathname)) return "/host";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return "/host"; }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// EMAIL-LINK COMPLETION (signup confirmation, magic link, recovery) for links that did not carry a PKCE `code`.
//
// WHY. The native app's Supabase client uses the implicit flow, so a confirmation or reset email requested FROM THE APP comes back with
// the session in the URL FRAGMENT (#access_token=...&refresh_token=...), and an expired or used link comes back as #error=...&error_code=...
// A server route never receives a fragment, so /auth/callback used to answer "missing_code" and the person landed on a screen that said
// nothing. Browsers keep the fragment across a redirect, so the callback now forwards such links to /auth/complete (a small client page),
// which reads the fragment, sets the session, and shows a clear message for dead links.

/** A signed-in landing for people who confirmed their email from the app: tells them to return to the app. */
export const CONFIRMED_PATH = "/auth/confirmed";
/** Client page that finishes a link whose credentials arrived in the URL fragment. */
export const COMPLETE_PATH = "/auth/complete";

/** token_hash types the callback may verify. Anything else is refused rather than passed to the auth server. */
export const TOKEN_HASH_TYPES = ["recovery", "signup", "email", "magiclink", "invite", "email_change"] as const;
export type TokenHashType = (typeof TOKEN_HASH_TYPES)[number];
export function isTokenHashType(value: string | null | undefined): value is TokenHashType {
  return !!value && (TOKEN_HASH_TYPES as readonly string[]).includes(value);
}

export type FragmentResult =
  | { kind: "tokens"; accessToken: string; refreshToken: string; type: string | null }
  | { kind: "error"; reason: "link_expired" | "link_error" }
  | { kind: "none" };

/** Reads the credentials (or the error) an auth email link left in the URL fragment. Never throws. */
export function parseAuthFragment(hash: string | null | undefined): FragmentResult {
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return { kind: "none" };
  let p: URLSearchParams;
  try { p = new URLSearchParams(raw); } catch { return { kind: "none" }; }
  if (p.get("error") || p.get("error_code")) {
    const code = (p.get("error_code") ?? "").toLowerCase();
    return { kind: "error", reason: code === "otp_expired" || code === "" || code.includes("expired") ? "link_expired" : "link_error" };
  }
  const accessToken = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken, type: p.get("type") };
  return { kind: "none" };
}

/** Plain-language text for the reason code the callback puts on /login?error=... or /reset-password?error=... */
export function authLinkErrorMessage(reason: string | null | undefined): string | null {
  switch (reason) {
    case "link_expired":
      return "That link has expired or was already used. Links like this work once and don't last long.";
    case "missing_code":
    case "link_error":
    case "invalid_type":
      return "We couldn't finish that link. It may have been cut off or opened in a different browser.";
    default:
      return null;
  }
}
