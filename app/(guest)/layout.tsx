import Link from "next/link";
import Image from "next/image";

// GUEST LAYOUT — deliberately quiet.
//
// Directive §7: guest web should feel like "entering the gathering", is
// "lighter than the host app, less expansive than the marketing
// website", and must be completable on a phone. §33: do not push app
// download at a guest doing a task that works without an account.
//
// So this layout has no navigation, no launch CTA, no "Join the Guest
// List", no social links and no store badges. Someone who was invited to
// a specific gathering is here to do one thing. The only marketing
// present is the mark itself, which is how they know the invitation is
// real and not a phishing page.
//
// The footer carries exactly two links: support, for a guest who is
// stuck, and privacy, because we are collecting their response. Both are
// obligations rather than promotion. Resist adding a third.

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite"
      >
        Skip to content
      </a>

      <header className="border-b border-sage/20 bg-offwhite">
        <div className="mx-auto flex max-w-prose items-center gap-2.5 px-6 py-4">
          <Image
            src="/images/pp-mark.png"
            alt=""
            aria-hidden
            width={26}
            height={26}
            className="rounded"
          />
          <span className="font-display text-base text-forest">
            Place &amp; Plenty
          </span>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="border-t border-sage/20 bg-offwhite py-8">
        <div className="mx-auto flex max-w-prose flex-col gap-2 px-6 font-body text-xs text-forest/50 sm:flex-row sm:items-center sm:justify-between">
          <p>Home Hosting. Made Simple.</p>
          <div className="flex gap-4">
            <Link href="/support" className="hover:text-forest">
              Need help?
            </Link>
            <Link href="/privacy" className="hover:text-forest">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
