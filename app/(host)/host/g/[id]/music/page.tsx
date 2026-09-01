import { notFound } from "next/navigation";
import { getGathering, getStyleBoard } from "@/lib/host-data";
import { getMusicMediaWorkspaceData } from "@/lib/music-media-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import MusicMediaWorkspace from "@/components/host/MusicMediaWorkspace";

export const metadata = { title: "My Music & Media" };

export default async function MusicPage({ params }: { params: { id: string } }) {
  const [gathering, workspace, style] = await Promise.all([
    getGathering(params.id),
    getMusicMediaWorkspaceData(params.id),
    getStyleBoard(params.id),
  ]);
  if (!gathering) notFound();

  const readOnly = ["completed", "cancelled", "archived"].includes(workspace.effectiveStatus);

  return (
    <div>
      <WorkspaceHeader
        title="My Music & Media"
        description="Shape the sound, the moments and the setup before the gathering starts."
      />

      {!workspace.entitled ? (
        <div className="mt-8 overflow-hidden rounded-card border border-gold/45 bg-parchment shadow-softer">
          <div className="p-6 md:p-7">
            <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Premium planning</p>
            <h2 className="mt-2 font-display text-2xl text-forest">Set the mood before people arrive.</h2>
            <p className="mt-3 max-w-2xl font-body leading-relaxed text-forest/70">
              My Music & Media keeps your soundtrack direction, playlist, must-plays, setup needs and guest song requests with this gathering. It’s included when this gathering is unlocked with a Gathering Pass or through Place & Plenty Plus.
            </p>
            <p className="mt-4 font-body text-sm text-forest/55">
              Gathering Pass — $9.99 + applicable taxes and fees · Plus — $59.99/year + applicable taxes and fees
            </p>
          </div>
        </div>
      ) : (
        <>
          {readOnly && (
            <div className="mt-6 rounded-card border border-sage/30 bg-cream px-5 py-4 font-body text-sm leading-relaxed text-forest/75">
              This gathering is finished. Your music plan and guest song requests are preserved here as part of the gathering record.
            </div>
          )}
          <MusicMediaWorkspace
            gatheringId={params.id}
            occasion={gathering.gathering_type}
            styleTheme={style.board?.theme ?? null}
            styleMood={style.board?.mood_descriptors ?? []}
            readOnly={readOnly}
            media={workspace.media}
            songRequests={workspace.songRequests}
          />
        </>
      )}
    </div>
  );
}
