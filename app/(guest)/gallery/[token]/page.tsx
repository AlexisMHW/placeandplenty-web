import type { Metadata } from "next";
import Link from "next/link";
import { lookupGallery, type GalleryResult } from "@/lib/guest-api";

// Bearer-token URL. Never indexed, never cached.
export const metadata: Metadata = {
  title: "Gathering Photos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Signed photo URLs live one hour. Rendering on the server means the
// browser gets URLs that are already valid, with no client round-trip
// and no key in the page.
export default async function GalleryPage({
  params,
}: {
  params: { token: string };
}) {
  const result = await lookupGallery(params.token);
  const data = result.data as GalleryResult | null;
  const state = data?.state ?? "not_found";

  // Unknown, revoked and never-shared are deliberately indistinguishable
  // on the server, and we keep them that way here: a link must not
  // reveal whether it once worked.
  if (state === "not_found") {
    return (
      <Shell>
        <p className="font-display text-2xl text-forest">
          This photo link isn&rsquo;t available.
        </p>
        <p className="mt-3 font-body text-forest/70">
          It may have been turned off by the host, or the link may be
          incomplete. Ask whoever shared it to send it again.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  if (state === "expired") {
    const expired = data as Extract<GalleryResult, { state: "expired" }>;
    return (
      <Shell>
        <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          {expired.gatheringName ?? "Place & Plenty"}
        </p>
        <p className="mt-4 font-display text-2xl text-forest">
          These photos have been put away.
        </p>
        <p className="mt-3 font-body text-forest/70">
          Gathering photos don&rsquo;t stay up forever — this gallery has
          reached the end of its window. If you need something from it,
          ask the host.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  const gallery = data as Extract<GalleryResult, { state: "ok" }>;

  if (gallery.photoCount === 0) {
    return (
      <Shell>
        <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          {gallery.gatheringName ?? "Place & Plenty"}
        </p>
        <p className="mt-4 font-display text-2xl text-forest">
          No photos yet.
        </p>
        <p className="mt-3 font-body text-forest/70">
          Check back once people have started adding them.
        </p>
        <HomeLink />
      </Shell>
    );
  }

  return (
    <div className="mx-auto max-w-editorial px-6 py-12 md:py-16">
      <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
        Gathering photos
      </p>
      <h1 className="mt-2 font-display text-3xl text-forest md:text-4xl">
        {gallery.gatheringName ?? "A gathering"}
      </h1>
      <p className="mt-3 font-body text-forest/70">
        {gallery.photoCount} {gallery.photoCount === 1 ? "photo" : "photos"}
        {gallery.expiresAt ? (
          <>
            {" · "}
            available until{" "}
            {new Date(gallery.expiresAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </>
        ) : null}
      </p>

      {/* Contributor names are deliberately absent — the host sees who
          uploaded what because they need it to moderate; other guests do
          not, and being named was never the contributor's choice. */}
      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.photos.map((photo) => (
          <li
            key={photo.id}
            className="overflow-hidden rounded-card border border-sage/30 bg-cream shadow-softer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption ?? "A photo from the gathering"}
              loading="lazy"
              className="h-64 w-full object-cover"
            />
            {photo.caption && (
              <p className="px-4 py-3 font-body text-sm leading-relaxed text-forest/80">
                {photo.caption}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-14 border-t border-sage/30 pt-8 text-center">
        <HomeLink />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-prose px-6 py-24 text-center">{children}</div>
  );
}

function HomeLink() {
  return (
    <Link
      href="/"
      className="mt-8 inline-block border-b border-gold font-body text-sm font-semibold uppercase tracking-wide text-goldInk transition-colors duration-400 hover:text-forest"
    >
      Place &amp; Plenty
    </Link>
  );
}
