import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import GatheringSettingsForm from "./GatheringSettingsForm";

// GATHERING SETTINGS — "gathering editing/settings" (§11).
//
// WHAT IS EDITABLE HERE IS DELIBERATELY NARROW: the things a host
// genuinely wants a keyboard for — the name, the date and time, where it
// is, how many people, and the notes. Everything else on `gatherings` is
// either derived (current_hostready_score, readiness_state), governed by
// business rules with their own flows (status, locked_in_at,
// completed_at, archived_at), or belongs to a dedicated surface
// (invitation artwork, weather, contingency).
//
// STATUS IS NOT EDITABLE HERE, and that is the important omission. The
// gatherings table carries enforce_lock_in_rules,
// enforce_completed_at_rules and enforce_one_open_gathering, plus
// notification triggers that fire on status and schedule changes. A
// status dropdown on a settings page would look like a harmless select
// and would in fact be the entry point to all of that. Those transitions
// belong in the app, where the flows around them exist.
//
// The date and time ARE editable, and they do fire
// handle_gathering_status_change_notifications. That is correct — moving
// a gathering is exactly when guests should be told.

export const metadata = { title: "Gathering settings" };

export default async function SettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const gathering = await getGathering(params.id);
  if (!gathering) notFound();

  return (
    <div>
      <WorkspaceHeader
        title="Settings"
        description="The details of this gathering."
      />
      <GatheringSettingsForm gathering={gathering} />
    </div>
  );
}
