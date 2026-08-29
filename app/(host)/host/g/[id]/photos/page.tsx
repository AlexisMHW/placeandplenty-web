import { getGatheringPhotos } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";

// MY GATHERING PHOTOS (§9, the look & the day).
//
// FINITE RETENTION IS A FEATURE, AND IT IS SURFACED. The table comment
// says it plainly: expires_at is set at upload, "because indefinite
// storage of guests' photos is not a defensible default". A host should
// be able to see that their guests' photos have an end date rather than
// discover it, so the expiry is shown rather than hidden.
//
// THUMBNAILS ARE NOT RENDERED, and that is deliberate rather than
// unfinished. gathering_photos stores a storage_path into a PRIVATE
// bucket; displaying one needs a signed URL, minted server-side, per
// image, with an expiry. That is real work with its own decisions — how
// long a signed URL lives, whether it is re-signed on refresh — and
// doing it badly either breaks the images or hands out longer-lived URLs
// than intended. Listing what exists, with captions and dates, is honest
// and useful in the meantime.
//
// CONTRIBUTOR NAMES ARE NOT SHOWN. A host legitimately needs them to
// moderate, and the column exists — but this surface has no moderation
// controls, so it has no use for the names either. They arrive with the
// feature that needs them.

export const metadata = { title: "My Gathering Photos" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export default async function PhotosPage({
  params,
}: {
  params: { id: string };
}) {
  const photos = await getGatheringPhotos(params.id);
  const visible = photos.filter((p) => !p.hidden_at);
  const hidden = photos.filter((p) => p.hidden_at);

  const nextExpiry = visible
    .map((p) => p.expires_at)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  return (
    <div>
      <WorkspaceHeader
        title="My Gathering Photos"
        description="The photos everyone took, in one place."
      />

      {photos.length === 0 ? (
        <EmptyState
          title="No photos yet."
          body="Share the gallery link and your guests can add theirs — no account, no app, just the link."
          hint="The gallery is switched on in the app."
        />
      ) : (
        <div className="mt-8 space-y-6">
          <Panel>
            <p className="font-display text-2xl text-forest">
              {visible.length} {visible.length === 1 ? "photo" : "photos"}
            </p>
            {hidden.length > 0 && (
              <p className="mt-1 font-body text-sm text-forest/65">
                {hidden.length} hidden
              </p>
            )}
            {nextExpiry && (
              <p className="mt-3 font-body text-sm leading-relaxed text-forest/65">
                Photos are kept for a limited time — the first of these
                expires on {formatDate(nextExpiry)}. Save anything you want
                to keep.
              </p>
            )}
          </Panel>

          <Panel>
            <ul className="divide-y divide-sage/20">
              {visible.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
                >
                  <p className="font-body text-base text-forest">
                    {p.caption || "Untitled"}
                  </p>
                  <p className="font-body text-sm text-forest/55">
                    {formatDate(p.created_at)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-body text-sm text-forest/60">
              Open the gallery in the app to see them.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}
