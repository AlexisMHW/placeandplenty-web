import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getGatheringPhotoWorkspaceWeb } from "@/lib/gathering-photos-data";
import { photoControlsOpen } from "@/lib/gathering-photo-window";
import { WorkspaceHeader } from "@/components/host/Workspace";
import GatheringPhotosWorkspace from "@/components/host/GatheringPhotosWorkspace";

export const metadata = { title: "My Gathering Photos" };

export default async function PhotosPage({ params }: { params: { id: string } }) {
  const [gathering, workspace] = await Promise.all([
    getGathering(params.id),
    getGatheringPhotoWorkspaceWeb(params.id),
  ]);
  if (!gathering) notFound();
  // Founder decision B: the server flag can only restrict. Completed gatherings get photo controls only inside the photo window; cancelled and archived never.
  const editable = workspace.editable && photoControlsOpen({ effectiveStatus: workspace.effectiveStatus, expiresAt: workspace.expiresAt });
  const completedInWindow = editable && workspace.effectiveStatus === "completed";

  return (
    <div>
      <WorkspaceHeader
        title="My Gathering Photos"
        description="The photos everyone took, gathered in one private host gallery."
      />

      {completedInWindow && (
        <div className="mt-6 rounded-card border border-sage/30 bg-cream px-5 py-4">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Photo sharing is still open</p>
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
            This gathering is complete, so its planning is read-only. You can still add and manage photos until the gallery window closes.
          </p>
        </div>
      )}

      {!editable && (
        <div className="mt-6 rounded-card border border-sage/30 bg-cream px-5 py-4">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Your gathering record</p>
          <h2 className="mt-1 font-display text-xl text-forest">This gallery is now preserved.</h2>
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
            You can still view the photos that remain, but this gathering is no longer accepting gallery changes.
          </p>
        </div>
      )}

      <GatheringPhotosWorkspace
        gatheringId={params.id}
        editable={editable}
        expiresAt={workspace.expiresAt}
        photos={workspace.photos}
      />
    </div>
  );
}
