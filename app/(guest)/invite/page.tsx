// Bare /invite, with no token.
//
// This exact path is what the native app declares as its Android
// verified App Link (autoVerify on https://placeandplenty.com/invite),
// so it should not be a default 404. Verification itself only reads
// /.well-known/assetlinks.json and never fetches this path, but a real
// person can still land here — a truncated link, a forwarded message
// that lost its tail, a typed URL.
//
// It deliberately does NOT redirect to the homepage. Someone who tapped
// an invitation and silently landed on marketing copy has no idea what
// went wrong.
//
// Mobile-first: this is almost always reached on a phone, from a
// messaging app, by someone who was invited to something. Single
// column, large tap targets, no assumptions about an account.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Invitation",
  // No canonical: a dead-end utility page, not a destination.
  // robots.txt disallows /invite/ (with the slash), which does not cover
  // this path, so the noindex has to be declared here.
  robots: { index: false, follow: false },
};

export default function InviteIndexPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-offwhite px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          Place &amp; Plenty
        </p>

        <h1 className="mt-4 font-display text-3xl leading-tight text-forest sm:text-4xl">
          This invitation link is incomplete.
        </h1>

        <p className="mt-4 font-body text-base leading-relaxed text-forest/70">
          Double-check the link you were sent, or ask the host to resend
          it.
        </p>

        <div className="mt-9 flex flex-col items-stretch gap-3">
          <Link
            href="/"
            className="rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Go to Place &amp; Plenty
          </Link>

          <Link
            href="/support"
            className="rounded-full border border-forest/30 px-7 py-3.5 font-body font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
          >
            Need help? Support
          </Link>
        </div>
      </div>
    </div>
  );
}
