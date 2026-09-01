import { getGatheringGuests, getGuestBook } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, StatusSelect, ActionButton } from "@/components/host/Editable";
import { setRsvpStatus } from "@/lib/host-actions";
import {
  addNewPersonToGatheringWeb,
  addSavedPersonToGatheringWeb,
  removePersonFromGatheringWeb,
  saveGatheringPersonToGuestBookWeb,
} from "@/lib/people-actions";
import { rsvpLabel } from "@/lib/host-format";

const RSVP_OPTIONS = ["yes", "maybe", "no", "invited", "no_response"].map(
  (value) => ({ value, label: rsvpLabel(value) })
);
const ORDER = ["yes", "maybe", "invited", "no_response", "no"];

export const metadata = { title: "My People" };

export default async function PeoplePage({ params }: { params: { id: string } }) {
  const [guests, guestBook] = await Promise.all([
    getGatheringGuests(params.id),
    getGuestBook(),
  ]);
  const guestIds = new Set(guests.map((row) => row.guest?.id).filter(Boolean));
  const savedIds = new Set(guestBook.saved.map((row) => row.id));
  const reusablePeople = guestBook.saved.filter((person) => !guestIds.has(person.id));
  const groups = ORDER.map((status) => ({
    status,
    rows: guests.filter((g) => g.rsvp_status === status),
  })).filter((group) => group.rows.length > 0);
  const coming = guests.filter((g) => g.rsvp_status === "yes");
  const plusOnes = coming.reduce((n, g) => n + (g.plus_one_count || 0), 0);

  return (
    <div>
      <WorkspaceHeader
        title="My People"
        description="Who's invited, who's coming, and what you need to know about them."
      />

      <section className="mt-7 max-w-4xl rounded-card border border-sage/25 bg-parchment px-5 py-4">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
          This gathering
        </p>
        <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
          My People is this gathering’s guest list. My Guest Book is your reusable list for next time. Adding or removing someone here never erases their history from another gathering.
        </p>
      </section>

      {reusablePeople.length > 0 && (
        <section className="mt-7 max-w-4xl">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/65">
            Invite again from My Guest Book
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {reusablePeople.map((person) => (
              <ActionButton
                key={person.id}
                action={addSavedPersonToGatheringWeb.bind(null, params.id, person.id)}
                className="rounded-full border border-sage/35 bg-offwhite px-4 py-2 font-body text-sm font-semibold text-forest transition hover:border-forest/45"
              >
                + {[person.first_name, person.last_name].filter(Boolean).join(" ")}
              </ActionButton>
            ))}
          </div>
        </section>
      )}

      <AddForm
        label="Add someone new"
        submitLabel="Add to this gathering"
        action={addNewPersonToGatheringWeb.bind(null, params.id)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="first_name" label="First name" required placeholder="Dana" />
          <Field name="last_name" label="Last name" placeholder="Whitfield" />
          <Field name="household_name" label="Household" placeholder="The Whitfields" />
          <Field name="email" label="Email" type="email" placeholder="optional" />
          <Field name="phone" label="Phone" placeholder="optional" />
          <Field name="dietary_notes" label="Dietary" placeholder="No shellfish" />
          <Field name="allergy_notes" label="Allergies" placeholder="optional" />
          <Field name="accessibility_notes" label="Accessibility" placeholder="Step-free access" />
          <label className="flex items-start gap-3 sm:col-span-2">
            <input name="save_to_guest_book" type="checkbox" defaultChecked className="mt-1 h-4 w-4 accent-forest" />
            <span className="font-body text-sm leading-relaxed text-forest/70">
              Keep this person in My Guest Book so they’re ready for another gathering.
            </span>
          </label>
        </div>
      </AddForm>

      {guests.length === 0 ? (
        <EmptyState
          title="No one on the list yet."
          body="Add someone new or bring a saved person over from My Guest Book."
        />
      ) : (
        <>
          <p className="mt-8 font-body text-base text-forest/75">
            <strong className="font-semibold text-forest">{coming.length + plusOnes}</strong>{" "}
            coming
            {plusOnes > 0 && <span className="text-forest/60"> (including {plusOnes} plus {plusOnes === 1 ? "one" : "ones"})</span>}
            {" "}· {guests.length} invited
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
                      ? [g.guest.first_name, g.guest.last_name].filter(Boolean).join(" ")
                      : "Guest";
                    const notes = [g.guest_dietary_notes, g.guest_allergy_notes, g.notes].filter(Boolean);
                    const isSaved = g.guest?.id ? savedIds.has(g.guest.id) : false;

                    return (
                      <li key={g.id} className="py-4">
                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-lg text-forest">
                              {name}
                              {g.plus_one_count > 0 && <span className="font-body text-sm text-forest/60"> +{g.plus_one_count}</span>}
                            </p>
                            {g.guest?.household_name && (
                              <p className="font-body text-sm text-forest/60">
                                {g.guest.household_name}{g.invitation_party_id && " · one household"}
                              </p>
                            )}
                            {g.guest?.email && <p className="mt-1 font-body text-sm text-forest/55">{g.guest.email}</p>}
                            {notes.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {notes.map((note, index) => (
                                  <li key={index} className="rounded-full border border-sage/40 px-3 py-0.5 font-body text-xs text-forest/70">{note}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="flex min-w-[12rem] flex-col items-end gap-3">
                            <StatusSelect
                              label={`RSVP for ${name}`}
                              value={g.rsvp_status}
                              options={RSVP_OPTIONS}
                              action={setRsvpStatus.bind(null, params.id, g.id)}
                            />
                            <div className="flex flex-wrap justify-end gap-3">
                              {!isSaved && g.guest?.id && (
                                <ActionButton
                                  action={saveGatheringPersonToGuestBookWeb.bind(null, params.id, g.guest.id)}
                                  className="font-body text-xs font-semibold text-forest/70 underline decoration-sage/50 underline-offset-4"
                                >
                                  Keep in My Guest Book
                                </ActionButton>
                              )}
                              <ActionButton
                                action={removePersonFromGatheringWeb.bind(null, params.id, g.id)}
                                confirm={`Remove ${name} from this gathering? Their Guest Book record and other gathering history will stay intact.`}
                                className="font-body text-xs text-forest/50 underline decoration-sage/50 underline-offset-4 hover:text-error"
                              >
                                Remove from this gathering
                              </ActionButton>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <p className="mt-8 font-body text-sm leading-relaxed text-forest/65">
            Setting an RSVP here writes the same record a guest’s own reply does — one answer per guest, however it reached you.
          </p>
        </>
      )}
    </div>
  );
}
