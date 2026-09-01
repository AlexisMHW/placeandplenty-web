import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getFindHelpContext } from "@/lib/find-help-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import FindHelpWorkspace from "@/components/host/FindHelpWorkspace";

export const metadata = { title: "Find Help" };

export default async function FindHelpPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { category?: string; needLabel?: string; source?: string; quantity?: string };
}) {
  const [gathering, context] = await Promise.all([
    getGathering(params.id),
    getFindHelpContext(params.id),
  ]);

  if (!gathering) notFound();

  const isTerminal = ["completed", "cancelled", "archived"].includes(
    gathering.effective_status
  );
  const smartNeed = searchParams?.needLabel?.trim() || null;

  return (
    <div>
      <WorkspaceHeader
        title="Find Help"
        description="When you need another pair of hands, a rental, or something you didn’t plan to need."
      />

      {isTerminal ? (
        <div className="mt-6 rounded-card border border-sage/30 bg-cream px-5 py-4 font-body text-sm leading-relaxed text-forest/75">
          This gathering is finished. Find Help is preserved as part of the planning experience, but there’s nothing left to search for here.
        </div>
      ) : (
        <>
          {searchParams?.source === "space_mode" && smartNeed && (
            <div className="mt-6 rounded-card bg-forest px-5 py-4 text-offwhite shadow-softer">
              <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-gold">
                Space Mode noticed a need
              </p>
              <p className="mt-1 font-display text-xl">
                {searchParams.quantity ? `${searchParams.quantity} ${smartNeed}` : smartNeed}
              </p>
            </div>
          )}

          <FindHelpWorkspace
            initialArea={context.weatherCity ?? ""}
            initialCategory={searchParams?.category ?? null}
            initialNeed={smartNeed}
          />
        </>
      )}
    </div>
  );
}
