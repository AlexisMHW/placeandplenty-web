import { getGatheringGuests } from "@/lib/host-data";
import {
  WorkspaceHeader,
  EmptyState,
  ReadOnlyNote,
} from "@/components/host/Workspace";
import { rsvpLabel } from "@/lib/host-format";

// MY PEOPLE — the gathering guest command centre (§10).
//
// §10: "One guest concept/record should connect invitation, RSVP,
// household/party, contribution, dietary notes, song request, relevant
// history." That is exactly the shape of the data — gathering_guests
// joins to guests, and carries rsvp_status, the invitation party, and
// per-gathering dietary/allergy notes — so this page shows them
// together rather than as separate lists.
//
// GROUPED BY ANSWER, NOT ALPHABETICALLY. What a host wants from this
// screen is a count and a chase list. "Who hasn't replied" is the
// actionable group, so it sits directly under "coming".
//
// HOUSEHOLDS ARE ONE UNIT. invitation_party_id is the household, and the
// guest contract is explicit that a household is ONE token, ONE RSVP
// unit, ONE recipient. Guests carrying a party id are labelled as such,
// so a host reading "4 coming" understands whether that is four replies
// or one household of four.
//
// NOT SHOWN: contact details beyond an email the host already stored,
// and nothing from other gatherings. This surface reads the same rows
// the app does, under the same RLS.

export const metadata = { title: "My People" };

const ORDER = ["yes", "maybe", "invited", "no_response", "no"];

export default async function PeoplePage({
  params,
}: {
  params: { id: string };
}) {
  const guests = await getGatheringGuests(params.id);

  const groups = ORDER.map((status) => ({
    status,
    rows: guests.filter((g) => g.rsvp_status === status),
  })).filter((g) => g.rows.length > 0);

  const coming = guests.filter((g) => g.rsvp_status === "yes");
  const plusOnes = coming.reduce((n, g) => n + (g.plus_one_count || 0), 0);

  return (
    <div>
      <WorkspaceHeader
        title="My People"
        description="Who's invited, who's coming, and what you need to know about them."
      />

      {guests.length === 0 ? (
        <EmptyState
          title="No one on the list yet."
          body="Add the people you're inviting and their replies land here as they come in."
          hint="Guests are added in the app, or pulled from My Guest Book."
        />
      ) : (
        <>
          <p className="mt-6 font-body text-base text-forest/75">
            <strong className="font-semibold text-forest">
              {coming.length + plusOnes}
            </strong>{" "}
            coming
            {plusOnes > 0 && (
              <span className="text-forest/60">
                {" "}
                (including {plusOnes} plus{" "}
                {plusOnes === 1 ? "one" : "ones"})
              </span>
            )}{" "}
            · {guests.length} invited
          </p>

          <div className="mt-8 space-y-10">
            {groups.map((group) => (
              <section key={group.status}>
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/70">
                  {rsvpLabel(group.status)} · {group.rows.length}
                </h3>
                <ul className="mt-4 divide-y divide-sage/20">
                  {group.rows.map((g) => {
                    const name = g.guest
                      ? [g.guest.first_name, g.guest.last_name]
                          .filter(Boolean)
                          .join(" ")
                      : "Guest";
                    const notes = [
                      g.guest_dietary_notes,
                      g.guest_allergy_notes,
                      g.notes,
                    ].filter(Boolean);

                    return (
                      <li key={g.id} className="py-3.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                          <div className="min-w-0">
                            <p className="font-display text-lg text-forest">
                              {name}
                              {g.plus_one_count > 0 && (
                                <span className="font-body text-sm text-forest/60">
                                  {" "}
                                  +{g.plus_one_count}
                                </span>
                              )}
                            </p>
                            {g.guest?.household_name && (
                              <p className="font-body text-sm text-forest/60">
                                {g.guest.household_name}
                                {g.invitation_party_id && " · one household"}
                              </p>
                            )}
                          </div>
                          {g.guest?.email && (
                            <p className="font-body text-sm text-forest/55">
                              {g.guest.email}
                            </p>
                          )}
                        </div>
                        {notes.length > 0 && (
                          <ul className="mt-1.5 flex flex-wrap gap-2">
                            {notes.map((n, i) => (
                              <li
                                key={i}
                                className="rounded-full border border-sage/40 px-3 py-0.5 font-body text-xs text-forest/70"
                              >
                                {n}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <ReadOnlyNote what="guest list" />
        </>
      )}
    </div>
  );
}
