"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for the authenticated host web app.
//
// Used only where the browser genuinely has to act: signing in, signing
// out, password reset, and putting a file the host just chose into
// storage. Data reads happen on the server (see lib/supabase-server.ts)
// so a gathering's contents are never fetched over a channel the page's
// own JavaScript has to be trusted to scope.
//
// THE UPLOAD IS ON THAT LIST FOR A REASON, not as an exception to it.
// The bytes are already in the browser, and the invitation-artwork
// bucket's RLS scopes the write by the first path segment on the server
// side regardless of what the page believes — so routing ten megabytes
// through a server action would add a hop and a body-size limit without
// adding a single guarantee. It is also the path the native app takes,
// which is what makes artwork uploaded on one surface visible on the
// other. The metadata that points a gathering at the object is still
// written server-side, through save_invitation_artwork() in
// lib/host-actions.ts.
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
