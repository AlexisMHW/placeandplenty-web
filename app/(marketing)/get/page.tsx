import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import CtaButton from "@/components/CtaButton";
import AppDownload from "@/components/AppDownload";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  hasAnyStoreLink,
} from "@/lib/app-links";
import { TAGLINE } from "@/lib/brand";

// /get — the platform-aware download forwarder.
//
// This is what the QR code on /pricing encodes, and what any "download
// the app" link should point at. One URL that works on both platforms,
// on our own domain, so a printed or displayed code never has to be
// regenerated because a store URL changed.
//
// Behaviour:
//   iPhone/iPad, App Store listing exists   -> redirect to the App Store
//   Android, Play listing exists            -> redirect to Google Play
//   desktop, or the matching listing absent -> render both options
//
// It redirects rather than rendering a chooser on a phone because someone
// who scanned a code labelled "scan to download" has already chosen.
//
// NEVER FALLS BACK TO THE HOMEPAGE. Sending a download request to
// marketing is the failure this route exists to prevent. With no store
// links at all it says so plainly and offers the Guest List, which is the
// honest next step while the app is pre-launch.
//
// DYNAMIC BY NECESSITY: it reads the request's user agent, so it cannot
// be prerendered. That is a deliberate cost on one small route.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get the app",
  description:
    `Download Place & Plenty for iPhone and Android. ${TAGLINE}`,
  alternates: { canonical: "/get" },
  openGraph: { url: "/get" },
  // A forwarder has nothing to index and would compete with /pricing and
  // the homepage for the same intent.
  robots: { index: false, follow: true },
};

export default function GetPage() {
  const ua = headers().get("user-agent") ?? "";

  // iPadOS reports itself as Macintosh with touch support, but an iPad
  // arriving here from a scanned code still wants the App Store, so the
  // narrower iOS test is the right one and desktop Macs correctly fall
  // through to the chooser below.
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (isIOS && APP_STORE_URL) redirect(APP_STORE_URL);
  if (isAndroid && PLAY_STORE_URL) redirect(PLAY_STORE_URL);

  return (
    <>
      <section className="bg-offwhite py-16 md:py-24">
        <div className="mx-auto max-w-prose px-6 text-center">
          <h1 className="font-display text-3xl leading-tight text-forest md:text-4xl">
            {hasAnyStoreLink()
              ? "Get Place & Plenty"
              : "Place & Plenty isn’t out yet."}
          </h1>
          <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
            {hasAnyStoreLink()
              ? "Choose your phone below, or open this page on the device you want it on."
              : "It’s close. Join the Guest List and we’ll tell you the day it lands — no other email, and nothing else to do."}
          </p>

          {!hasAnyStoreLink() && (
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <CtaButton />
              <Link
                href="/what-it-does"
                className="inline-flex items-center justify-center rounded-full border border-forest px-7 py-3.5 font-body font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
              >
                See what it does
              </Link>
            </div>
          )}
        </div>
      </section>

      <AppDownload />
    </>
  );
}
