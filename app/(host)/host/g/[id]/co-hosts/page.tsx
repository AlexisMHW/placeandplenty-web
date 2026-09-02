import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase-server";
import { getGathering } from "@/lib/host-data";
import { getCoHostWorkspace } from "@/lib/cohost-data";
import { WorkspaceHeader } from "@/components/host/Workspace";
import CoHostManager from "@/components/host/CoHostManager";

export const metadata = { title: "My Co-Hosts" };

const LABELS: Record<string, string> = {
  invited: "Invited",
  accepted: "Sharing this gathering",
  declined: "Declined",
};

export default async function CoHostsPage({ params }: { params: { id: string } }) {
  const [gathering, members, user] = await Promise.all([
    getGathering(params.id),
    getCoHostWorkspace(params.id),
    getUser(),
  ]);

  if (!gathering) notFound();

  const isOwner = Boolean(user && user.id === gathering.owner_user_id);
  const isReadOnly = ["completed", "cancelled", "archived"].includes(gathering.effective_status);

  return (
    <div>
      <WorkspaceHeader
        title="My Co-Hosts"
        description="The people helping you pull this off."
      />

      {isOwner && !isReadOnly ? (
        <CoHostManager gatheringId={params.id} members={members} />
      ) : (
        <ReadOnlyList members={members} isReadOnly={isReadOnly} />
      )}
    </div>
  );
}

function ReadOnlyList({
  members,
  isReadOnly,
}: {
  members: Awaited<ReturnType<typeof getCoHostWorkspace>>;
  isReadOnly: boolean;
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
              <p className="font-body text-base text-forest">{m.invited_email}</p>
              <p className="font-body text-sm text-forest/65">{LABELS[m.status] ?? m.status}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 rounded-card border border-sage/30 bg-cream px-4 py-3 font-body text-sm leading-relaxed text-forest/75">
        {isReadOnly
          ? "This gathering is finished, so co-host access is preserved as part of the gathering record and can no longer be changed."
          : "Only the host who created this gathering can invite or remove co-hosts."}
      </p>
    </>
  );
}
