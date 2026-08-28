import { getCoHosts } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";

// MY CO-HOSTS (§9, your people) — "share the load".
//
// gathering_member_status is: invited | accepted | declined | removed.
// Removed members are filtered out rather than shown greyed: they are
// history, and a list of people who used to have access is not something
// a host is trying to read on this screen.
//
// ONLY THE EMAIL AND THE STATE ARE SHOWN. gathering_members carries an
// acceptance_token_hash, which is a credential — it is not selected in
// lib/host-data.ts at all, so it cannot reach the page even by accident.

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
  const members = (await getCoHosts(params.id)).filter(
    (m) => m.status !== "removed"
  );

  const accepted = members.filter((m) => m.status === "accepted");

  return (
    <div>
      <WorkspaceHeader
        title="My Co-Hosts"
        description="The people helping you pull this off."
      />

      {members.length === 0 ? (
        <EmptyState
          title="You’re running this one solo."
          body="Invite a co-host and they can see the plan, the list and the guests — and change them."
          hint="Co-hosts are invited in the app."
        />
      ) : (
        <>
          <p className="mt-6 font-body text-base text-forest/75">
            {accepted.length === 0
              ? "No one has accepted yet."
              : `${accepted.length} ${accepted.length === 1 ? "person is" : "people are"} sharing this gathering with you.`}
          </p>

          <ul className="mt-6 divide-y divide-sage/20">
            {members.map((m) => (
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

          <ReadOnlyNote what="co-hosts" />
        </>
      )}
    </div>
  );
}
