import { getGathering, getCoHosts } from "@/lib/host-data";
import { getPeopleWorkspace } from "@/lib/people-data";
import {
  getContributionWorkspace,
  getContributionMessages,
} from "@/lib/contribution-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, ActionButton, StatusSelect } from "@/components/host/Editable";
import { addContribution, setContributionStatus, deleteContribution } from "@/lib/host-actions";
import { setContributionAssignmentWeb } from "@/lib/contribution-actions";
import { contributionLabel } from "@/lib/host-format";

const STATUS_OPTIONS = [
  "needed",
  "asked",
  "claimed",
  "confirmed",
  "completed",
  "declined",
  "cancelled",
].map((value) => ({ value, label: contributionLabel(value) }));

const OPEN = ["needed", "asked"];
const SETTLED = ["claimed", "confirmed", "completed"];

export const metadata = { title: "Who’s Bringing What" };

export default async function ContributionsPage({ params }: { params: { id: string } }) {
  const [gathering, contributions, people, cohosts, messages] = await Promise.all([
    getGathering(params.id),
    getContributionWorkspace(params.id),
    getPeopleWorkspace(params.id),
    getCoHosts(params.id),
    getContributionMessages(params.id),
  ]);

  const isArchived = gathering?.effective_status === "archived" || gathering?.status === "archived";
  const acceptedCohosts = cohosts.filter((m) => m.status === "accepted");

  const guestName = new Map<string, string>();
  const partyName = new Map<string, string>();
  for (const row of people) {
    if (row.guest) {
      guestName.set(
        row.guest.id,
        [row.guest.first_name, row.guest.last_name].filter(Boolean).join(" ")
      );
    }
    if (row.invitation_party_id && row.party) {
      partyName.set(row.invitation_party_id, row.party.party_name || "Household");
    }
  }
  const cohostName = new Map(acceptedCohosts.map((m) => [m.id, m.invited_email]));

  const messagesByContribution = new Map<string, typeof messages>();
  for (const message of messages) {
    const list = messagesByContribution.get(message.contribution_id) ?? [];
    list.push(message);
    messagesByContribution.set(message.contribution_id, list);
  }

  function claimant(c: (typeof contributions)[number]): string | null {
    if (c.contributor_type === "owner") return "You";
    if (c.contributor_type === "co_host" && c.gathering_member_id)
      return cohostName.get(c.gathering_member_id) ?? "A co-host";
    if (c.contributor_type === "guest" && c.guest_id)
      return guestName.get(c.guest_id) ?? "A guest";
    if (c.contributor_type === "household" && c.invitation_party_id)
      return partyName.get(c.invitation_party_id) ?? "A household";
    return null;
  }

  function assignmentValue(c: (typeof contributions)[number]): string {
    if (c.contributor_type === "guest" && c.guest_id) return `guest:${c.guest_id}`;
    if (c.contributor_type === "co_host" && c.gathering_member_id) return `cohost:${c.gathering_member_id}`;
    if (c.contributor_type === "household" && c.invitation_party_id) return `household:${c.invitation_party_id}`;
    if (c.contributor_type === "owner") return "owner";
    return "unassigned";
  }

  const baseAssignments = [
    { value: "unassigned", label: "Still open" },
    { value: "owner", label: "Me / the host" },
    ...acceptedCohosts.map((m) => ({ value: `cohost:${m.id}`, label: m.invited_email })),
    ...people
      .filter((p) => p.guest)
      .map((p) => ({
        value: `guest:${p.guest!.id}`,
        label: [p.guest!.first_name, p.guest!.last_name].filter(Boolean).join(" "),
      })),
  ];

  const attention = contributions.filter((c) => c.needs_host_attention);
  const open = contributions.filter((c) => OPEN.includes(c.status) && !c.needs_host_attention);
  const settled = contributions.filter((c) => SETTLED.includes(c.status) && !c.needs_host_attention);
  const declined = contributions.filter((c) => c.status === "declined" && !c.needs_host_attention);
  const cancelled = contributions.filter((c) => c.status === "cancelled" && !c.needs_host_attention);
  const sections = [
    { key: "attention", heading: "Needs your attention", rows: attention },
    { key: "open", heading: "Still open", rows: open },
    { key: "settled", heading: "Sorted", rows: settled },
    { key: "declined", heading: "Declined", rows: declined },
    { key: "cancelled", heading: "Cancelled", rows: cancelled },
  ].filter((s) => s.rows.length > 0);

  return (
    <div>
      <WorkspaceHeader
        title="Who’s Bringing What"
        description="Share the load without losing track of who said yes to what."
      />

      {isArchived && (
        <div className="mt-6 rounded-card border border-gold/40 bg-cream p-4 font-body text-sm text-forest/75">
          This gathering is archived. Contributions are preserved here as part of the gathering record.
        </div>
      )}

      {contributions.length === 0 ? (
        <EmptyState
          title="Nothing asked for yet."
          body="Ask for what you actually need — bread, ice, a side, extra chairs — and keep every answer in one place."
        />
      ) : (
        <div className="mt-8 space-y-10">
          {sections.map((section) => (
            <section key={section.key}>
              <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                {section.heading} · {section.rows.length}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.rows.map((c) => {
                  const who = claimant(c);
                  const source = c.linked_menu_item_id
                    ? "From My Table"
                    : c.linked_shopping_item_id
                    ? "From My Shopping"
                    : null;
                  const currentAssignment = assignmentValue(c);
                  const assignmentOptions =
                    c.contributor_type === "household" && c.invitation_party_id
                      ? [
                          {
                            value: currentAssignment,
                            label: partyName.get(c.invitation_party_id) ?? "Household",
                          },
                          ...baseAssignments,
                        ]
                      : baseAssignments;
                  const itemMessages = messagesByContribution.get(c.id) ?? [];

                  return (
                    <li key={c.id} className="rounded-card border border-sage/25 bg-offwhite p-5 shadow-softer">
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <p className="font-display text-lg text-forest">{c.item_name}</p>
                            {(c.quantity != null || c.unit) && (
                              <span className="font-body text-sm text-forest/60">
                                {c.quantity ?? ""}{c.unit ? ` ${c.unit}` : ""}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-body text-sm text-forest/65">
                            {c.category}{who ? ` · ${who}` : ""}
                          </p>
                          {source && (
                            <p className="mt-1 font-body text-xs font-semibold uppercase tracking-[0.12em] text-goldInk">
                              {source}
                            </p>
                          )}
                          {c.notes && <p className="mt-2 font-body text-sm text-forest/70">{c.notes}</p>}
                          {c.attention_reason && <p className="mt-2 font-body text-sm text-error">{c.attention_reason}</p>}

                          {itemMessages.length > 0 && (
                            <div className="mt-4 space-y-2 border-l-2 border-gold/45 pl-4">
                              {itemMessages.map((message) => (
                                <div key={message.id}>
                                  <p className="font-body text-sm text-forest/80">{message.message}</p>
                                  <p className="mt-0.5 font-body text-xs text-forest/50">
                                    {message.sender_type === "guest"
                                      ? `From ${who ?? "guest"}`
                                      : message.sender_type === "co_host"
                                      ? "From a co-host"
                                      : "From the host"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {!isArchived && (
                          <div className="flex min-w-[220px] flex-col gap-3">
                            <StatusSelect
                              label={`Who is bringing ${c.item_name}`}
                              value={currentAssignment}
                              options={assignmentOptions}
                              action={setContributionAssignmentWeb.bind(null, params.id, c.id)}
                            />
                            <StatusSelect
                              label={`Status for ${c.item_name}`}
                              value={c.status}
                              options={STATUS_OPTIONS}
                              action={setContributionStatus.bind(null, params.id, c.id)}
                            />
                            <ActionButton
                              action={deleteContribution.bind(null, params.id, c.id)}
                              confirm={`Remove "${c.item_name}" from Who’s Bringing What?`}
                              className="self-end font-body text-sm text-forest/55 underline decoration-sage/50 underline-offset-4 hover:text-error"
                            >
                              Remove
                            </ActionButton>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!isArchived && (
        <AddForm
          label="Ask for something"
          submitLabel="Add to the list"
          action={addContribution.bind(null, params.id)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="item_name" label="What you need" required placeholder="A green vegetable" />
            <Field name="category" label="Category" placeholder="Side" />
            <Field name="quantity" label="How many" type="number" placeholder="1" />
            <Field name="unit" label="Unit" placeholder="dish" />
            <Field
              name="notes"
              label="Anything to say about it"
              placeholder="For eight, please"
              className="sm:col-span-2"
            />
          </div>
        </AddForm>
      )}

      <p className="mt-6 font-body text-sm leading-relaxed text-forest/65">
        Assigning something to a guest or co-host now moves it to Asked automatically. Their answer and any note come back to this same contribution record.
      </p>
    </div>
  );
}
