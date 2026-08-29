import { getMusicMedia, getSongRequests } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";

// MY MUSIC & MEDIA (§9, the look & the day) — "set the mood".
//
// GUEST SONG REQUESTS ARE THE REASON THIS SURFACE EARNS A DESKTOP.
// guest-song-request-submit writes them and, per the app audit, there is
// still no client service reading them on the native side — so a host
// currently has no way to see what their guests asked for. Listing them
// here is the one place in the web app that shows something the app
// cannot yet show at all.
//
// Requests are shown WITHOUT contributor names. The table carries
// guest_id, but a song request is a small confidence, and naming people
// beside their choices changes what people are willing to ask for. The
// host can see what was asked; who asked is not needed to queue it.

export const metadata = { title: "My Music & Media" };

export default async function MusicPage({
  params,
}: {
  params: { id: string };
}) {
  const [media, requests] = await Promise.all([
    getMusicMedia(params.id),
    getSongRequests(params.id),
  ]);

  const notes = [
    { label: "Moments that need something", value: media?.moments_notes },
    { label: "Must play", value: media?.must_play_notes },
    { label: "Please don't", value: media?.do_not_play_notes },
    { label: "Songs that matter", value: media?.special_songs_notes },
  ].filter((n) => n.value);

  const hasPlan =
    media &&
    (media.playlist_url ||
      (media.music_styles?.length ?? 0) > 0 ||
      notes.length > 0 ||
      (media.audio_needs?.length ?? 0) > 0 ||
      (media.visual_needs?.length ?? 0) > 0);

  return (
    <div>
      <WorkspaceHeader
        title="My Music & Media"
        description="Sort the sound before people arrive, not during."
      />

      {!hasPlan && requests.length === 0 ? (
        <EmptyState
          title="Nothing set yet."
          body="Pick a mood, drop in a playlist, and note the two songs that have to be on it."
          hint="The music plan is set in the app."
        />
      ) : (
        <div className="mt-8 space-y-6">
          {hasPlan && (
            <Panel>
              {media?.music_styles && media.music_styles.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {media.music_styles.map((style) => (
                    <li
                      key={style}
                      className="rounded-full border border-sage/40 px-3 py-1 font-body text-sm text-forest/75"
                    >
                      {style}
                    </li>
                  ))}
                </ul>
              )}

              {media?.playlist_url && (
                <p className="mt-4 font-body text-base">
                  <a
                    href={media.playlist_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forest underline decoration-gold underline-offset-4"
                  >
                    Open the playlist
                  </a>
                </p>
              )}

              {notes.length > 0 && (
                <dl className="mt-5 space-y-4">
                  {notes.map((n) => (
                    <div key={n.label}>
                      <dt className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                        {n.label}
                      </dt>
                      <dd className="mt-1 font-body text-base leading-relaxed text-forest/80">
                        {n.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {media?.explicit_allowed === false && (
                <p className="mt-4 font-body text-sm text-forest/65">
                  Keeping it clean — no explicit tracks.
                </p>
              )}
            </Panel>
          )}

          <Panel>
            <h3 className="font-display text-xl text-forest">
              What your guests asked for
            </h3>
            {requests.length === 0 ? (
              <p className="mt-2 font-body text-base text-forest/70">
                No requests yet. Guests can add one from their invitation.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-sage/20">
                {requests.map((r) => (
                  <li key={r.id} className="py-2.5">
                    <p className="font-body text-base text-forest">
                      {r.song_title}
                      {r.artist && (
                        <span className="text-forest/60"> — {r.artist}</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
