import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import GuestPageClient from "./GuestPageClient";
import GuestLivingPanel from "@/components/guest/GuestLivingPanel";
import { lookupGuestPage } from "@/lib/guest-api";
import { lookupGuestLivingPage } from "@/lib/guest-living-server";
import { buildInvitePreview } from "@/lib/invite-preview";
import { isPreviewCrawler } from "@/lib/preview-crawlers";

// This route must never be indexed: it's reached only via a bearer-token link sent in an invitation. robots.txt also disallows
// /invite/, but the per-page directive is the primary control (noindex stays on every branch below).
//
// Link preview (what iMessage / WhatsApp / Gmail show for the text or email link): the host's name, the gathering title and the host's
// invitation artwork only (lib/invite-preview.ts). Never the address, the time of day, private notes, or anything about the household.
// An unknown / revoked link, or a completed / cancelled / archived gathering, gets a generic preview that does not name the gathering.
const getGuestPage = cache((token: string) => lookupGuestPage(token));

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const noindex = { index: false, follow: false } as const;
  const result = await getGuestPage(params.token);
  const d = result.ok ? result.data : null;
  const preview = buildInvitePreview({
    found: !!d,
    displayName: d?.displayName,
    hostDisplayName: d?.hostDisplayName,
    displayDate: d?.displayDate,
    gatheringStatus: d?.gatheringStatus,
    isArchived: d?.isArchived,
    hasArtwork: !!d?.invitationArtwork && d.invitationMode === "uploaded",
  });
  if (preview.kind === "unknown") return { title: preview.title, robots: noindex };
  const { title, description } = preview;
  const images = preview.showArtwork ? [{ url: `/invite/${params.token}/preview` }] : undefined;
  return {
    title,
    description,
    robots: noindex,
    openGraph: { title, description, type: "website", siteName: "Place & Plenty", ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

// Never prerendered, never cached. Guest surfaces resolve live so an
// edited invitation or update cannot disagree with the host workspace.
export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  // A link-preview fetcher (iMessage / WhatsApp / Slack / ...) gets a CARD-ONLY page: the same title, host name, date and artwork
  // that generateMetadata exposes, and nothing from the guest page itself. No household data, address, time, notes or guest names
  // are rendered or even fetched for it (lib/preview-crawlers.ts). Everything else, including a spoofed agent name, is unchanged.
  if (isPreviewCrawler(headers().get("user-agent"))) {
    const r = await getGuestPage(params.token);
    const d = r.ok ? r.data : null;
    const card = buildInvitePreview({
      found: !!d,
      displayName: d?.displayName,
      hostDisplayName: d?.hostDisplayName,
      displayDate: d?.displayDate,
      gatheringStatus: d?.gatheringStatus,
      isArchived: d?.isArchived,
      hasArtwork: false,
    });
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">{card.title}</p>
        <p className="mt-3 font-body text-forest/70">{card.description}</p>
      </div>
    );
  }

  const [result, livingResult] = await Promise.all([
    getGuestPage(params.token),
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
