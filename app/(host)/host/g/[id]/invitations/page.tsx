import { notFound } from "next/navigation";
import InvitationArtworkManager from "@/components/host/InvitationArtworkManager";
import { WorkspaceHeader } from "@/components/host/Workspace";
import { getGathering, signArtwork } from "@/lib/host-data";
import { createClient } from "@/lib/supabase-server";

export const metadata = { title: "My Invitations" };

export default async function InvitationsPage({ params }: { params: { id: string } }) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  const supabase = createClient();
  const [{ data: artworkMeta }, artwork] = await Promise.all([
    supabase
      .from("gatherings")
      .select("invitation_artwork_original_filename, invitation_artwork_mime_type")
      .eq("id", params.id)
      .maybeSingle(),
    signArtwork([gathering]),
  ]);

  const readOnly = ["completed", "cancelled", "archived"].includes(
    gathering.effective_status
  );

  return (
    <div>
      <WorkspaceHeader
        title="My Invitations"
        description="Use your own artwork or keep the invitation identity connected to this gathering."
      />

      <InvitationArtworkManager
        gatheringId={gathering.id}
        gatheringName={gathering.name}
        currentFilename={artworkMeta?.invitation_artwork_original_filename ?? null}
        currentMimeType={artworkMeta?.invitation_artwork_mime_type ?? null}
        currentArtworkUrl={artwork.get(gathering.id) ?? null}
        readOnly={readOnly}
      />

      <section className="mt-6 rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
          What stays connected
        </p>
        <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-forest/70">
          Changing the artwork does not create another guest list or invitation record. My People, RSVPs, Who's Bringing What, guest communications and Paper Suite all continue to use this same gathering.
        </p>
      </section>
    </div>
  );
}
