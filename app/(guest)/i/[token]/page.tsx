import type { Metadata } from "next";
import ShareInviteClient from "./ShareInviteClient";
import { lookupShareInvite } from "@/lib/guest-api";
import { buildPreviewDescription, isShareToken } from "@/lib/share-invite";

// One stable link per gathering. Reached only by someone who was handed
// the link, so it is noindex via the page directive (not robots.txt:
// message and social apps must still be able to fetch the preview).
export const dynamic = "force-dynamic";

type Params = { params: { token: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const base: Metadata = { title: "You're Invited", robots: { index: false, follow: false } };
  if (!isShareToken(params.token)) return base;
  const result = await lookupShareInvite(params.token);
  if (!result.ok || !result.data) return base;
  const d = result.data;
  const title = d.displayName || "You're invited";
  const description = buildPreviewDescription(d);
  // The preview image route serves the host's artwork when it is a
  // supported image, else the branded fallback. No location or guest
  // information is ever part of the metadata.
  const image = `/i/${params.token}/preview`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `/i/${params.token}` },
    openGraph: { title, description, type: "website", url: `/i/${params.token}`, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
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
