import type { Metadata } from "next";
import GuestPageClient from "./GuestPageClient";
import GuestLivingPanel from "@/components/guest/GuestLivingPanel";
import { lookupGuestPage } from "@/lib/guest-api";
import { lookupGuestLivingPage } from "@/lib/guest-living-server";

// This route must never be indexed — it's reached only via a
// bearer-token link sent in an invitation. robots.txt also disallows
// /invite/, but the per-page directive is the primary control.
export const metadata: Metadata = {
  title: "You're Invited",
  robots: { index: false, follow: false },
};

// Never prerendered, never cached. Guest surfaces resolve live so an
// edited invitation or update cannot disagree with the host workspace.
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const [result, livingResult] = await Promise.all([
    lookupGuestPage(params.token),
    lookupGuestLivingPage(params.token),
  ]);

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

  const initialData = result.ok ? result.data : null;
  const livingData = livingResult.ok ? livingResult.data : null;

  return (
    <>
      <GuestPageClient token={params.token} initialData={initialData} />
      <GuestLivingPanel
        token={params.token}
        gatheringName={initialData?.displayName || "this gathering"}
        initialData={livingData}
      />
    </>
  );
}
