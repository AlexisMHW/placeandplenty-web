import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase-server";
import { getCoHosts, getGathering } from "@/lib/host-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import CoHostManager from "@/components/host/CoHostManager";

// MY CO-HOSTS (§9, your people) — "share the load".
//
// gathering_member_status is: invited | accepted | declined | removed.
//
// ONLY THE OWNER MANAGES MEMBERSHIP, and that is enforced in the
// database rather than here: create_gathering_invitation() and
// remove_gathering_member() both raise 'not authorized' for anyone who
// is not the owner. The page still checks, because a co-host should see
// who else is helping without being shown controls that would refuse
// them — an affordance that always fails is worse than no affordance.
//
// ONLY THE EMAIL AND THE STATE ARE SHOWN. gathering_members carries an
// acceptance_token_hash, which is a credential — it is not selected in
// lib/host-data.ts at all, so it cannot reach the page even by accident.
// The RAW token is different: it exists for one server-action round trip
// after an invitation is minted, is handed to the owner who minted it,
// and is never stored on the web side.

export const metadata = { title: "My Co-Hosts" };

const LABELS: Record<string, string> = {
  invited: "Invited",
  accepted: "Sharing this gathering",
  declined: "Declined",
};

export default async function CoHostsPage({
  params,
}: {
  params: { id: string };
}) {
  const [gathering, members, user] = await Promise.all([
    getGathering(params.id),
    getCoHosts(params.id),
    getUser(),
  ]);

  if (!gathering) notFound();

  const isOwner = Boolean(user && user.id === gathering.owner_user_id);
  const isArchived = gathering.status === "archived";

  return (
    <div>
      <WorkspaceHeader
        title="My Co-Hosts"
        description="The people helping you pull this off."
      />

      {isOwner && !isArchived ? (
        <CoHostManager gatheringId={params.id} members={members} />
      ) : (
        <ReadOnlyList members={members} isArchived={isArchived} />
      )}
    </div>
  );
}

/**
 * What a co-host sees, and what anyone sees on an archived gathering.
 *
 * An archived gathering rejects every write at the database level, so
 * offering an invite form there would be a form that cannot succeed.
 */
function ReadOnlyList({
  members,
  isArchived,
}: {
  members: Awaited<ReturnType<typeof getCoHosts>>;
  isArchived: boolean;
}) {
  const active = members.filter((m) => m.status !== "removed");

  return (
    <>
      {active.length === 0 ? (
        <p className="mt-6 font-body text-base text-forest/75">
          No one else is helping with this one.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-sage/20">
          {active.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
            >
              <p className="font-body text-base text-forest">
                {m.invited_email}
              </p>
              <p className="font-body text-sm text-forest/65">
                {LABELS[m.status] ?? m.status}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 rounded-card border border-sage/30 bg-cream px-4 py-3 font-body text-sm leading-relaxed text-forest/75">
        {isArchived
          ? "This gathering is archived, so who can reach it is settled. Unarchive it in the app to change that."
          : "Only the host who created this gathering can invite or remove co-hosts."}
      </p>
    </>
  );
}
