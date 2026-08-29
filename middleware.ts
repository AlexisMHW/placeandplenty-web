import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session refresh, and the gate in front of /host.
//
// TWO JOBS, and the first is easy to miss. Supabase access tokens are
// short-lived. Without a refresh on each request the cookie silently
// expires and a host is bounced to /login mid-task even though they
// never signed out. That is what the getUser() call below is really
// doing — the redirect is the visible part, the refresh is the point.
//
// getUser() rather than getSession(): getSession() trusts whatever the
// cookie says, getUser() revalidates it with the auth server. A gate
// that trusts an unverified cookie is not a gate.
//
// The matcher deliberately excludes static assets and image
// optimisation, so this runs on documents rather than on every .png.
// Public marketing routes still pass through — they need the session
// refresh so the header can show "My Gatherings" instead of "Log in" —
// but only /host is redirected.

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/host") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to where they were trying to go. Only a path is carried,
    // never an absolute URL — taking `next` as given would turn the
    // login page into an open redirect.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in host has no use for the login or sign-up pages. /signup
  // is included because a second account created while already holding
  // one is the beginning of the duplicate-identity problem the whole
  // one-account rule exists to prevent.
  if ((pathname === "/login" || pathname === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/host";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.well-known/|admin|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json)$).*)",
  ],
};
