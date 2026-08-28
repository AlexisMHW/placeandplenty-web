import { getContributions, getGatheringGuests } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";
import { contributionLabel } from "@/lib/host-format";

// WHO'S BRINGING WHAT (§9, your people).
//
// §10: contribution-centred, using the same underlying guest and
// gathering records — which is precisely why the claimant is resolved
// from the gathering's own guest list below rather than from a separate
// contributions-with-names view. One record, read two ways.
//
// THE HOUSEHOLD/PER-GUEST SPLIT IS REAL AND IS NOT COSMETIC. A
// contribution can be attributed to an individual (guest_id) or to a
// household (invitation_party_id). The guest web currently sends
// household claims, and the server's guest-page projection only
// recognises those — so a per-guest claim exists in the data but is
// invisible on the guest page. That is a known server-side gap (see
// RECONCILIATION-NOTES item 4). This surface shows BOTH, because a host
// looking at their own gathering should see what is actually recorded
// even where the guest projection cannot.
//
// ORDERED BY WHAT NEEDS DOING. Anything flagged needs_host_attention
// first, then still-open items, then everything settled — a host opens
// this page to find gaps, not to admire a complete list.

export const metadata = { title: "Who’s Bringing What" };

const OPEN = ["needed", "asked"];
const SETTLED = ["claimed", "confirmed", "completed"];

export default async function ContributionsPage({
  params,
}: {
  params: { id: string };
}) {
  const [contributions, guests] = await Promise.all([
    getContributions(params.id),
    getGatheringGuests(params.id),
  ]);

  // guest_id points at guests.id; gathering_guests carries the join.
  const nameByGuestId = new Map<string, string>();
  const householdByPartyId = new Map<string, string>();
  for (const g of guests) {
    if (g.guest) {
      nameByGuestId.set(
        g.guest.id,
        [g.guest.first_name, g.guest.last_name].filter(Boolean).join(" ")
      );
      if (g.invitation_party_id) {
        householdByPartyId.set(
          g.invitation_party_id,
          g.guest.household_name || `${g.guest.first_name}’s household`
        );
      }
    }
  }

  function claimant(c: (typeof contributions)[number]): string | null {
    if (c.guest_id) return nameByGuestId.get(c.guest_id) ?? "A guest";
    if (c.invitation_party_id)
      return householdByPartyId.get(c.invitation_party_id) ?? "A household";
    if (c.contributor_type === "owner") return "You";
    if (c.contributor_type === "co_host") return "A co-host";
    return null;
  }

  const attention = contributions.filter((c) => c.needs_host_attention);
  const open = contributions.filter(
    (c) => OPEN.includes(c.status) && !c.needs_host_attention
  );
  const settled = contributions.filter(
    (c) => SETTLED.includes(c.status) && !c.needs_host_attention
  );
  const declined = contributions.filter((c) => c.status === "declined");

  const sections = [
    { key: "attention", heading: "Needs your attention", rows: attention },
    { key: "open", heading: "Still open", rows: open },
    { key: "settled", heading: "Sorted", rows: settled },
    { key: "declined", heading: "Declined", rows: declined },
  ].filter((s) => s.rows.length > 0);

  return (
    <div>
      <WorkspaceHeader
        title="Who’s Bringing What"
        description="Contributions, tied to the same guests and the same gathering."
      />

      {contributions.length === 0 ? (
        <EmptyState
          title="Nothing asked for yet."
          body="Ask for what you actually need — a green vegetable, bread, ice — and guests can claim it from their invitation."
          hint="Contributions are set up in the app."
        />
      ) : (
        <>
          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section key={section.key}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {section.heading} · {section.rows.length}
                </h3>
                <ul className="mt-4 divide-y divide-sage/20">
                  {section.rows.map((c) => {
                    const who = claimant(c);
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="font-display text-lg text-forest">
                            {c.item_name}
                            {c.quantity != null && c.quantity > 1 && (
                              <span className="font-body text-sm text-forest/60">
                                {" "}
                                ×{c.quantity}
                                {c.unit ? ` ${c.unit}` : ""}
                              </span>
                            )}
                          </p>
                          {who && (
                            <p className="font-body text-sm text-forest/65">
                              {who}
                            </p>
                          )}
                          {c.notes && (
                            <p className="mt-0.5 font-body text-sm text-forest/60">
                              {c.notes}
                            </p>
                          )}
                          {c.attention_reason && (
                            <p className="mt-0.5 font-body text-sm text-error">
                              {c.attention_reason}
                            </p>
                          )}
                        </div>
                        <p className="font-body text-sm text-forest/65">
                          {contributionLabel(c.status)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <ReadOnlyNote what="contributions" />
        </>
      )}
    </div>
  );
}
