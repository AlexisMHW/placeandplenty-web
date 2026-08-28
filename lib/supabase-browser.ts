"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for the authenticated host web app.
//
// Used only where the browser genuinely has to act: signing in, signing
// out, and password reset. Data reads happen on the server (see
// lib/supabase-server.ts) so a gathering's contents are never fetched
// over a channel the page's own JavaScript has to be trusted to scope.
//
// Distinct from lib/supabase.ts, which is the plain anon client for the
// two public marketing form inserts and holds no session. Keeping them
// apart means a marketing form can never accidentally act as a
// signed-in host, and signing out cannot break a public form.
//
// createBrowserClient writes the session to cookies rather than
// localStorage, which is what lets the server client and middleware see
// it at all.

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  // A singleton, because each call otherwise registers its own auth
  // listener and they multiply across client navigations.
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
