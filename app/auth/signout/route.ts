import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Sign-out is POST-only, deliberately.
//
// A GET sign-out can be triggered by anything that loads a URL — a
// prefetch, an image tag on another site, a link in an email. That is
// CSRF with a mild payload: annoying rather than dangerous, but there is
// no reason to accept it. The host shell posts a form here.

export async function POST(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), {
    // 303 so the browser follows with GET rather than re-POSTing.
    status: 303,
  });
}
