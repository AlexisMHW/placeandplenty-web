import type { Metadata } from "next";
import GuestPageClient from "./GuestPageClient";
import { lookupGuestPage } from "@/lib/guest-api";

// This route must never be indexed — it's reached only via a
// bearer-token link sent in an invitation. robots.txt also disallows
// /invite/, but the per-page directive is the primary control.
export const metadata: Metadata = {
  title: "You're Invited",
  robots: { index: false, follow: false },
};

// Never prerendered, never cached. guest-page-lookup resolves live, and
// the app repo is explicit that an edited invitation must not be served
// from a frozen copy — a guest page that disagrees with My People is
// worse than a slow one.
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  // Fetched on the server so the invitation is painted on first byte.
  // This is opened on a phone, from a message, by someone deciding
  // whether to tap through — a blank skeleton while JS boots and a
  // round-trip completes was the wrong trade on the most mobile-
  // critical surface in the product.
  const result = await lookupGuestPage(params.token);

  // An invalid token is a final answer, so say so without shipping a
  // client render to discover it.
  if (result.status === 404) {
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">
          This invitation link isn&rsquo;t valid.
        </p>
        <p className="mt-3 font-body text-forest/70">
          Double-check the link, or reach out to whoever invited you.
        </p>
      </div>
    );
  }

  // Anything else — a transient upstream failure — falls through with no
  // initial data and the client retries. Better than showing a dead end
  // for something that may work a second later.
  const initialData = result.ok ? result.data : null;

  return <GuestPageClient token={params.token} initialData={initialData} />;
}
