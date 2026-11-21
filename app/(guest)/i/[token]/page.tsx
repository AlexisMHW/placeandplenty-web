import type { Metadata } from "next";
import ShareInviteClient from "./ShareInviteClient";
import { lookupShareInvite } from "@/lib/guest-api";
import { isShareToken } from "@/lib/share-invite";
import { buildInvitePreview } from "@/lib/invite-preview";

// One stable link per gathering. Reached only by someone who was handed
// the link, so it is noindex via the page directive (not robots.txt:
// message and social apps must still be able to fetch the preview).
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const noindex = { index: false, follow: false } as const;
  const known = isShareToken(params.token);
  const result = known ? await lookupShareInvite(params.token) : null;
  const d = result && result.ok ? result.data : null;
  // Host name + gathering title + invitation artwork only (lib/invite-preview.ts). No location, time of day, notes or guest information, ever.
  // A revoked / unknown link, or a completed / cancelled / archived gathering, gets a generic preview that does not name the gathering.
  const preview = buildInvitePreview({
    found: !!d,
    displayName: d?.displayName,
    hostDisplayName: d?.hostDisplayName,
    displayDate: d?.displayDate,
    gatheringStatus: d?.gatheringStatus,
    isArchived: d?.isArchived,
    hasArtwork: !!d?.artwork,
  });
  if (preview.kind === "unknown") return { title: preview.title, robots: noindex };
  const { title, description } = preview;
  // The preview image route serves the host's artwork when it is a supported image, else the branded fallback.
  const images = preview.showArtwork ? [{ url: `/i/${params.token}/preview` }] : undefined;
  return {
    title,
    description,
    robots: noindex,
    alternates: { canonical: `/i/${params.token}` },
    openGraph: { title, description, type: "website", siteName: "Place & Plenty", url: `/i/${params.token}`, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

export default async function ShareInvitePage({ params }: Params) {
  const result = isShareToken(params.token) ? await lookupShareInvite(params.token) : null;
  // A busy or briefly unavailable service must not read as "your link is wrong".
  if (result && !result.ok && (result.status === 429 || result.status >= 500)) {
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">This invitation is taking a moment to load.</p>
        <p className="mt-3 font-body text-forest/70">Please wait a minute and refresh the page. Your link is fine.</p>
      </div>
    );
  }
  if (!result || !result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-prose px-6 py-24 text-center">
        <p className="font-display text-2xl text-forest">This invitation link isn&rsquo;t valid.</p>
        <p className="mt-3 font-body text-forest/70">
          Double-check the link, or reach out to whoever invited you.
        </p>
      </div>
    );
  }
  return <ShareInviteClient token={params.token} data={result.data} />;
}
