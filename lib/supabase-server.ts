import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client for the authenticated host web app.
//
// ONE BACKEND, ONE CANONICAL RECORD (§2). This client uses the SAME
// project, the SAME anon key and the SAME Supabase Auth identity as the
// native app. A host who signs in here sees the gatherings they already
// have, because they are the same rows — there is no web-side mirror and
// no second account model.
//
// SECURITY MODEL: RLS, NOT SERVICE ROLE.
//
// Every read and write below goes out as the signed-in user, so Postgres
// decides what they may see, using the policies the native app already
// relies on:
//
//   gatherings           owner_user_id = auth.uid() OR is_accepted_gathering_member(id)
//   guests               owner_user_id = auth.uid()
//   menu_items etc.      is_accepted_gathering_member(gathering_id)
//   hosting_closet_items owner_user_id = auth.uid() AND user_can_access_closet(auth.uid())
//
// The service-role key is NOT used here and must never be. It bypasses
// RLS entirely; on a web surface that would mean one missed ownership
// check exposing another host's gathering. Service-role belongs to the
// guest Edge Functions, which resolve a token first and run server-side
// in Supabase — not in a Next.js route that a browser can reach.
//
// The upshot is that the web app cannot leak data the native app would
// not also leak, because they are enforced by the same policies in the
// same place.
//
// Cookie writes throw inside Server Components (Next only permits them
// in Route Handlers, Server Actions and middleware). That is expected:
// middleware.ts refreshes the session on every request, so the failure
// below is genuinely safe to swallow rather than a bug being hidden.

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component. middleware.ts already
            // refreshed the session for this request.
          }
        },
      },
    }
  );
}

/**
 * The signed-in user, or null.
 *
 * Uses getUser(), NOT getSession(). getSession() reads the cookie and
 * trusts it; getUser() revalidates the JWT with the auth server. On a
 * server surface deciding what data to return, the difference is whether
 * a forged or stale cookie is believed.
 */
export async function getUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
