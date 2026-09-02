import { notFound } from "next/navigation";
import { getGathering, getGuestBook } from "@/lib/host-data";
import { getPeopleWorkspace } from "@/lib/people-data";
import { getUser } from "@/lib/supabase-server";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { AddForm, Field, StatusSelect, ActionButton } from "@/components/host/Editable";
import { setRsvpStatus } from "@/lib/host-actions";
import {
  addNewPersonToGatheringWeb,
  addSavedPersonToGatheringWeb,
  createHouseholdWeb,
  removePersonFromGatheringWeb,
  saveGatheringPersonToGuestBookWeb,
  sendGuestMessageWeb,
  sendInvitationToPartyWeb,
  updateGatheringPersonDetailsWeb,
  updateGatheringPersonWeb,
} from "@/lib/people-actions";
import { rsvpLabel } from "@/lib/host-format";

const RSVP_OPTIONS = ["yes", "maybe", "no", "invited", "no_response"].map(
  (value) => ({ value, label: rsvpLabel(value) })
);
const ORDER = ["yes", "maybe", "invited", "no_response", "no"];
const INPUT = "w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest";

export const metadata = { title: "My People" };

function deliveryLabel(firstShare: string | null | undefined, latest: string | null): string {
  if (!firstShare) return "Not sent";
  if (!latest) return "Queued";
  const labels: Record<string, string> = {
    proposed: "Queued",
    scheduled: "Queued",
    processing: "Queued",
    pending: "Queued",
    queued: "Queued",
    sent: "Sent",
    delivered: "Delivered",
    opened: "Opened",
    failed: "Needs attention",
    bounced: "Needs attention",
    skipped: "Not sent",
    cancelled: "Not sent",
  };
  return labels[latest] ?? latest.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function PeoplePage({ params }: { params: { id: string } }) {
  const [gathering, guests, guestBook, user] = await Promise.all([
    getGathering(params.id),
    getPeopleWorkspace(params.id),
    getGuestBook(),
    getUser(),
  ]);
  if (!gathering) notFound();

  const isArchived = gathering.status === "archived";
  const isOwner = !!user && user.id === gathering.owner_user_id;
  const guestIds = new Set(guests.map((row) => row.guest?.id).filter(Boolean));
  const savedIds = new Set(guestBook.saved.map((row) => row.id));
  const reusablePeople = isOwner ? guestBook.saved.filter((person) => !guestIds.has(person.id)) : [];
  const groups = ORDER.map((status) => ({
    status,
    rows: guests.filter((g) => g.rsvp_status === status),
  })).filter((group) => group.rows.length > 0);
  const coming = guests.filter((g) => g.rsvp_status === "yes");
  const plusOnes = coming.reduce((n, g) => n + (g.plus_one_count || 0), 0);

  // A household is one invitation recipient even when several people belong
  // to it. Party-level controls render once, beside the first member only.
  const leadByParty = new Map<string, string>();
  const parties = new Map<string, { id: string; name: string; email: string | null }>();
  for (const row of guests) {
    if (!row.invitation_party_id || !row.party) continue;
    if (!leadByParty.has(row.invitation_party_id)) leadByParty.set(row.invitation_party_id, row.id);
    if (!parties.has(row.invitation_party_id)) {
      const fallback = row.guest
        ? [row.guest.first_name, row.guest.last_name].filter(Boolean).join(" ")
        : "Guest";
      parties.set(row.invitation_party_id, {
        id: row.invitation_party_id,
        name: row.party.party_name || fallback,
        email: row.party.contact_email,
      });
    }
  }

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
          My People is this gathering’s guest list. My Guest Book is your reusable list for next time. Invitations, RSVPs, household replies and guest updates all stay attached to this same gathering record.
        </p>
        {!isOwner && !isArchived && (
          <p className="mt-3 font-body text-sm text-forest/65">
            As a co-host, you can manage this gathering’s replies, invitation contacts, plus-ones and host notes. The host’s reusable Guest Book stays private to their account.
          </p>
        )}
        {isArchived && (
          <p className="mt-3 font-body text-sm font-semibold text-forest/75">
            This gathering is archived. Its people and replies are preserved here as read-only history.
          </p>
        )}
      </section>

      {!isArchived && isOwner && reusablePeople.length > 0 && (
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

      {!isArchived && isOwner && reusablePeople.length > 0 && (
        <AddForm
          label="Add a household"
          submitLabel="Add as one household"
          action={createHouseholdWeb.bind(null, params.id)}
        >
          <Field name="party_name" label="Household or group name" required placeholder="The Whitfields" />
          <p className="mt-3 font-body text-sm leading-relaxed text-forest/65">
            Choose the people who should receive one invitation and reply together as one household.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reusablePeople.map((person) => (
              <label key={person.id} className="flex items-center gap-2 rounded-md border border-sage/25 bg-parchment px-3 py-2">
                <input type="checkbox" name="guest_ids" value={person.id} className="h-4 w-4 accent-forest" />
                <span className="font-body text-sm text-forest">
                  {[person.first_name, person.last_name].filter(Boolean).join(" ")}
                </span>
              </label>
            ))}
          </div>
        </AddForm>
      )}

      {!isArchived && isOwner && (
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
      )}

      {!isArchived && guests.length > 0 && (
        <AddForm
          label="Send a guest update"
          submitLabel="Queue message"
          action={sendGuestMessageWeb.bind(null, params.id)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="subject" label="Subject" required placeholder="A quick update" />
            <label className="block">
              <span className="mb-1 block font-body text-sm font-semibold text-forest">Who should get it?</span>
              <select name="audience" defaultValue="all" className={INPUT}>
                <option value="all">Everyone still in play</option>
                <option value="coming">Coming + maybe</option>
                <option value="awaiting">Still awaiting a reply</option>
                <option value="selected">Only selected people / households</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block font-body text-sm font-semibold text-forest">Message</span>
              <textarea name="body" required rows={5} className={INPUT} placeholder="What do your people need to know?" />
            </label>
          </div>
          {parties.size > 0 && (
            <div className="mt-4">
              <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-forest/55">
                For “selected” only
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Array.from(parties.values()).map((party) => (
                  <label key={party.id} className="flex items-center gap-2 rounded-md border border-sage/25 bg-parchment px-3 py-2">
                    <input type="checkbox" name="party_ids" value={party.id} className="h-4 w-4 accent-forest" />
                    <span className="font-body text-sm text-forest">{party.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 font-body text-xs leading-relaxed text-forest/55">
            Messages use the same Place & Plenty communication queue as the app. They are not marked sent until delivery actually advances.
          </p>
        </AddForm>
      )}

      {guests.length === 0 ? (
        <EmptyState
          title="No one on the list yet."
          body={isOwner ? "Add someone new or bring a saved person over from My Guest Book." : "The host hasn’t added anyone to this gathering yet."}
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
                    const notes = [
                      g.guest?.dietary_notes || g.guest_dietary_notes,
                      g.guest?.allergy_notes || g.guest_allergy_notes,
                      g.guest?.accessibility_notes,
                      g.notes,
                    ].filter(Boolean) as string[];
                    const isSaved = g.guest?.id ? savedIds.has(g.guest.id) : false;
                    const isPartyLead = !!g.invitation_party_id && leadByParty.get(g.invitation_party_id) === g.id;
                    const invitationState = deliveryLabel(
                      g.party?.first_share_initiated_at,
                      g.latest_invitation_delivery_status
                    );

                    return (
                      <li key={g.id} className="py-5">
                        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-lg text-forest">
                              {name}
                              {g.plus_one_count > 0 && <span className="font-body text-sm text-forest/60"> +{g.plus_one_count}</span>}
                            </p>
                            {g.guest?.household_name && (
                              <p className="font-body text-sm text-forest/60">{g.guest.household_name}</p>
                            )}
                            {isOwner && g.guest?.email && <p className="mt-1 font-body text-sm text-forest/55">{g.guest.email}</p>}
                            {isOwner && g.guest?.phone && <p className="font-body text-sm text-forest/55">{g.guest.phone}</p>}
                            {notes.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {notes.map((note, index) => (
                                  <li key={index} className="rounded-full border border-sage/40 px-3 py-0.5 font-body text-xs text-forest/70">{note}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="flex min-w-[12rem] flex-col items-end gap-3">
                            {isArchived ? (
                              <span className="rounded-md border border-sage/30 bg-parchment px-3 py-1 font-body text-sm text-forest/65">
                                {rsvpLabel(g.rsvp_status)}
                              </span>
                            ) : (
                              <StatusSelect
                                label={`RSVP for ${name}`}
                                value={g.rsvp_status}
                                options={RSVP_OPTIONS}
                                action={setRsvpStatus.bind(null, params.id, g.id)}
                              />
                            )}

                            {!isArchived && (
                              <div className="flex flex-wrap justify-end gap-3">
                                {isOwner && !isSaved && g.guest?.id && (
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
                            )}
                          </div>
                        </div>

                        {isPartyLead && g.party && (
                          <div className="mt-4 rounded-card border border-sage/25 bg-parchment px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-5">
                            <div>
                              <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">
                                Invitation · {invitationState}
                              </p>
                              <p className="mt-1 font-body text-sm font-semibold text-forest">
                                {g.party.party_name || name}
                              </p>
                              <p className="font-body text-xs text-forest/55">
                                {g.party.contact_email || "No email on this invitation yet"}
                              </p>
                            </div>
                            {!isArchived && g.party.contact_email && (
                              <ActionButton
                                action={sendInvitationToPartyWeb.bind(null, params.id, g.party.id)}
                                className="mt-3 rounded-full border border-forest px-4 py-2 font-body text-xs font-semibold text-forest sm:mt-0"
                              >
                                {g.party.first_share_initiated_at ? "Queue again" : "Send invitation"}
                              </ActionButton>
                            )}
                          </div>
                        )}

                        {!isArchived && g.guest && isOwner && (
                          <AddForm
                            label={`Edit ${name}`}
                            submitLabel="Save person"
                            action={updateGatheringPersonWeb.bind(null, params.id, g.id)}
                          >
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field name="first_name" label="First name" required defaultValue={g.guest.first_name} />
                              <Field name="last_name" label="Last name" defaultValue={g.guest.last_name} />
                              <Field name="dietary_notes" label="Dietary" defaultValue={g.guest.dietary_notes} />
                              <Field name="allergy_notes" label="Allergies" defaultValue={g.guest.allergy_notes} />
                              <Field name="accessibility_notes" label="Accessibility" defaultValue={g.guest.accessibility_notes} />
                              <Field name="plus_one_count" label="Plus ones" type="number" defaultValue={g.plus_one_count} />
                              <label className="block sm:col-span-2">
                                <span className="mb-1 block font-body text-sm font-semibold text-forest">Host note for this gathering</span>
                                <textarea name="host_notes" rows={3} defaultValue={g.notes ?? ""} className={INPUT} />
                              </label>
                              {isPartyLead && g.party ? (
                                <>
                                  <Field name="party_name" label="Invitation household / recipient name" required defaultValue={g.party.party_name} />
                                  <Field name="contact_email" label="Invitation email" type="email" defaultValue={g.party.contact_email} />
                                </>
                              ) : (
                                <>
                                  <input type="hidden" name="party_name" value={g.party?.party_name ?? ""} />
                                  <input type="hidden" name="contact_email" value={g.party?.contact_email ?? ""} />
                                </>
                              )}
                            </div>
                            <p className="mt-3 font-body text-xs leading-relaxed text-forest/55">
                              Name, dietary, allergy and accessibility details belong to this person in your Guest Book record. Host note, RSVP and plus-one count belong only to this gathering.
                            </p>
                          </AddForm>
                        )}

                        {!isArchived && g.guest && !isOwner && (
                          <AddForm
                            label={`Edit gathering details for ${name}`}
                            submitLabel="Save gathering details"
                            action={updateGatheringPersonDetailsWeb.bind(null, params.id, g.id)}
                          >
                            <div className="grid gap-4 sm:grid-cols-2">
                              <Field name="plus_one_count" label="Plus ones" type="number" defaultValue={g.plus_one_count} />
                              <label className="block sm:col-span-2">
                                <span className="mb-1 block font-body text-sm font-semibold text-forest">Host note for this gathering</span>
                                <textarea name="host_notes" rows={3} defaultValue={g.notes ?? ""} className={INPUT} />
                              </label>
                              {isPartyLead && g.party ? (
                                <>
                                  <Field name="party_name" label="Invitation household / recipient name" required defaultValue={g.party.party_name} />
                                  <Field name="contact_email" label="Invitation email" type="email" defaultValue={g.party.contact_email} />
                                </>
                              ) : (
                                <>
                                  <input type="hidden" name="party_name" value={g.party?.party_name ?? ""} />
                                  <input type="hidden" name="contact_email" value={g.party?.contact_email ?? ""} />
                                </>
                              )}
                            </div>
                            <p className="mt-3 font-body text-xs leading-relaxed text-forest/55">
                              These are gathering-only details. The host’s reusable Guest Book identity and private contact record are not changed.
                            </p>
                          </AddForm>
                        )}
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
