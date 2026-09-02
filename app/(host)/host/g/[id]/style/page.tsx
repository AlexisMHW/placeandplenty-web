import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getStyleBoardWorkspace } from "@/lib/style-board-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import StyleBoardWorkspace from "@/components/host/StyleBoardWorkspace";

export const metadata = { title: "My Style Board" };

export default async function StylePage({ params }: { params: { id: string } }) {
  const [gathering, workspace] = await Promise.all([
    getGathering(params.id),
    getStyleBoardWorkspace(params.id),
  ]);
  if (!gathering) notFound();

  const readOnly = ["completed", "cancelled", "archived"].includes(gathering.effective_status);

  return (
    <div>
      <WorkspaceHeader
        title="My Style Board"
        description="Collect the feeling, colors and visual cues you want to carry through the gathering."
      />

      {!workspace.entitled ? (
        <div className="mt-8 overflow-hidden rounded-card border border-gold/45 bg-parchment shadow-softer">
          <div className="p-6 md:p-7">
            <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Premium planning</p>
            <h2 className="mt-2 font-display text-2xl text-forest">Build the look before you start buying things.</h2>
            <p className="mt-3 max-w-2xl font-body leading-relaxed text-forest/70">
              My Style Board keeps your theme, palette, mood, inspiration photos and visual analysis with this gathering. It’s included when this gathering is unlocked with a Gathering Pass or through Place & Plenty Plus.
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
              This gathering is finished. Your Style Board is preserved here exactly as part of the gathering record.
            </div>
          )}
          <StyleBoardWorkspace
            gatheringId={params.id}
            occasion={gathering.gathering_type}
            readOnly={readOnly}
            board={workspace.board}
            images={workspace.images}
            components={workspace.components}
            synthesis={workspace.synthesis}
          />
        </>
      )}
    </div>
  );
}
