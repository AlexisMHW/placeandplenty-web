import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getUser } from "@/lib/supabase-server";
import { WorkspaceHeader } from "@/components/host/Workspace";
import GatheringSettingsForm from "./GatheringSettingsForm";
import GatheringLifecyclePanel from "./GatheringLifecyclePanel";

// GATHERING SETTINGS — details plus the canonical lifecycle surface.
//
// Editable gathering details remain deliberately narrow: name, date/time,
// place, headcount and notes. Lifecycle fields are never written directly
// from this page. Archive, restore, finish, cancel and Gather Again call the
// existing backend RPCs through GatheringLifecyclePanel, so Host Web and
// native have the same authority and consequences without duplicating rules.

export const metadata = { title: "Gathering settings" };

export default async function SettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const [gathering, user] = await Promise.all([
    getGathering(params.id),
    getUser(),
  ]);
  if (!gathering) notFound();

  return (
    <div>
      <WorkspaceHeader
        title="Gathering details"
        description="The details of this gathering — and the lifecycle actions that belong to it."
      />
      <GatheringSettingsForm gathering={gathering} />
      <GatheringLifecyclePanel
        gathering={gathering}
        isOwner={user?.id === gathering.owner_user_id}
      />
    </div>
  );
}
