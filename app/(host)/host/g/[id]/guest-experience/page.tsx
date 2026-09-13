import { notFound } from "next/navigation";
import { getGathering } from "@/lib/host-data";
import { getGuestExperience } from "@/lib/guest-experience-data";
import {
  deleteGuestUpdateWeb,
  publishGuestUpdateWeb,
  saveGuestExperienceSettingsWeb,
} from "@/lib/guest-experience-actions";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";
import { ActionButton, AddForm } from "@/components/host/Editable";

export const metadata = { title: "Guest Experience" };
const INPUT = "w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest";
const CATEGORY_LABELS: Record<string, string> = {
  general: "General update", weather_contingency: "Weather / contingency", location_change: "Location change",
  time_change: "Time change", parking_arrival: "Parking / arrival", food_menu: "Food / menu", reminder: "Reminder", other: "Other",
};

export default async function GuestExperiencePage({ params }: { params: { id: string } }) {
  const [gathering, experience] = await Promise.all([getGathering(params.id), getGuestExperience(params.id)]);
  if (!gathering) notFound();

  const isArchived = gathering.effective_status === "archived";
  const s = experience.settings;
  const detailRows = [
    ["Attire / Dress Code", s.attire_text], ["Arrival & Parking", s.arrival_parking_text],
    ["Transportation", s.transportation_text], ["What to Bring", s.what_to_bring_text], ["Good to Know", s.important_details_text],
  ].filter((row) => row[1]);

  return (
    <div>
      <WorkspaceHeader title="Guest Experience" description="What your guests need to know after they RSVP — and the updates they can come back to throughout the gathering." />

      <section className="mt-7 max-w-4xl rounded-card border border-sage/25 bg-parchment px-5 py-5">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">Living guest page</p>
        <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/70">Your invitation link stays useful after the RSVP. Guests can return for attire, arrival details, transportation, what to bring, important updates, song requests you enable, and acknowledgements you ask for.</p>
        {isArchived && <p className="mt-3 font-body text-sm font-semibold text-forest/75">This gathering is archived. Guest details and updates are preserved as read-only history.</p>}
      </section>

      <section className="mt-8 max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/60">Guest details</p><h2 className="mt-2 font-display text-2xl text-forest">What everyone should know</h2></div>
          <span className="rounded-full border border-sage/35 bg-offwhite px-3 py-1.5 font-body text-xs font-semibold text-forest/70">Song requests {s.show_song_request ? "on" : "off"}</span>
        </div>

        {detailRows.length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{detailRows.map(([label, value]) => (
          <article key={label as string} className="rounded-card border border-sage/25 bg-offwhite px-5 py-4">
            <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.16em] text-forest/50">{label}</p>
            <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-forest/75">{value}</p>
          </article>
        ))}</div> : <p className="mt-4 font-body text-sm text-forest/60">No extra guest details added yet.</p>}

        {!isArchived && <AddForm label="Edit guest details" submitLabel="Save guest details" action={saveGuestExperienceSettingsWeb.bind(null, params.id)}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["attire_text", "Attire / Dress Code", "Cocktail casual, costumes encouraged, wear team colors…", s.attire_text],
              ["arrival_parking_text", "Arrival & Parking", "Use the side entrance; parking is behind the building…", s.arrival_parking_text],
              ["transportation_text", "Transportation", "Shuttle leaves at 6:30; rideshare recommended…", s.transportation_text],
              ["what_to_bring_text", "What to Bring", "Swimsuit, lawn chair, favorite game…", s.what_to_bring_text],
              ["important_details_text", "Good to Know", "Kids welcome, gate code, outdoor gathering…", s.important_details_text],
            ].map(([name, label, placeholder, value]) => <label key={name as string} className="block">
              <span className="mb-1 block font-body text-sm font-semibold text-forest">{label}</span>
              <textarea name={name as string} rows={3} defaultValue={(value as string | null) ?? ""} placeholder={placeholder as string} className={INPUT} />
            </label>)}
            <label className="flex items-start gap-3 rounded-md border border-sage/25 bg-parchment px-4 py-3 sm:col-span-2">
              <input name="show_song_request" type="checkbox" defaultChecked={s.show_song_request} className="mt-1 h-4 w-4 accent-forest" />
              <span><span className="block font-body text-sm font-semibold text-forest">Accept song requests from guests</span><span className="mt-1 block font-body text-xs leading-relaxed text-forest/60">Free for every gathering. Requests show up in My Music & Media; advanced music planning can still remain a Plus feature.</span></span>
            </label>
          </div>
        </AddForm>}
      </section>

      <section className="mt-12 max-w-4xl">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/60">Guest updates</p>
        <h2 className="mt-2 font-display text-2xl text-forest">Keep everyone in the loop</h2>
        <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/65">“Seen” means the update was displayed on that household’s secure guest page. For something important, require a “Got it” acknowledgement too.</p>

        {!isArchived && <AddForm label="Publish an update" submitLabel="Publish to guest pages" action={publishGuestUpdateWeb.bind(null, params.id)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Update type</span><select name="category" defaultValue="general" className={INPUT}>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Who should see it?</span><select name="audience" defaultValue="all" className={INPUT}><option value="all">All invited households</option><option value="coming">Coming + maybe</option><option value="awaiting">Still awaiting a reply</option><option value="selected">Only selected households</option></select></label>
            <label className="block sm:col-span-2"><span className="mb-1 block font-body text-sm font-semibold text-forest">Title</span><input name="title" required maxLength={120} placeholder="Party moved indoors" className={INPUT} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block font-body text-sm font-semibold text-forest">Message</span><textarea name="body" required rows={5} maxLength={4000} placeholder="Because of the weather, we’re moving everything inside. Please enter through the side door." className={INPUT} /></label>
            <label className="flex items-start gap-3"><input name="important" type="checkbox" className="mt-1 h-4 w-4 accent-forest" /><span className="font-body text-sm text-forest/75">Mark as important</span></label>
            <label className="flex items-start gap-3"><input name="require_acknowledgement" type="checkbox" className="mt-1 h-4 w-4 accent-forest" /><span className="font-body text-sm text-forest/75">Ask guests to tap “Got it”</span></label>
          </div>
          {experience.parties.length > 0 && <div className="mt-4"><p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-forest/55">For “selected” only</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{experience.parties.map((party) => <label key={party.id} className="flex items-center gap-2 rounded-md border border-sage/25 bg-parchment px-3 py-2"><input type="checkbox" name="party_ids" value={party.id} className="h-4 w-4 accent-forest" /><span className="font-body text-sm text-forest">{party.name}</span></label>)}</div></div>}
        </AddForm>}

        {experience.updates.length === 0 ? <EmptyState title="No guest updates yet." body="Publish changes, reminders, arrival notes, or anything your guests should be able to find again." /> : <div className="mt-6 space-y-3">{experience.updates.map((update) => (
          <article key={update.id} className={`rounded-card border px-5 py-5 ${update.importance === "important" ? "border-gold/55 bg-parchment" : "border-sage/25 bg-offwhite"}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.16em] text-forest/50">{CATEGORY_LABELS[update.category] ?? "Update"}</p>
                <h3 className="mt-2 font-display text-xl text-forest">{update.title}</h3>
                <p className="mt-2 whitespace-pre-wrap font-body text-sm leading-relaxed text-forest/70">{update.body}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-body text-xs font-semibold text-forest/60"><span>Seen by {update.seen} of {update.targeted} households</span>{update.require_acknowledgement && <span>Got it: {update.acknowledged} of {update.targeted}</span>}</div>
                <details className="mt-3 rounded-md border border-sage/20 bg-white/50 px-3 py-2 font-body text-xs text-forest/65">
                  <summary className="cursor-pointer font-semibold text-forest/70">See household status</summary>
                  <div className="mt-2 space-y-1.5">
                    <p><strong>Seen:</strong> {update.seenNames.length ? update.seenNames.join(", ") : "None yet"}</p>
                    <p><strong>Not seen:</strong> {update.unseenNames.length ? update.unseenNames.join(", ") : "Everyone targeted has seen it"}</p>
                    {update.require_acknowledgement && <><p><strong>Got it:</strong> {update.acknowledgedNames.length ? update.acknowledgedNames.join(", ") : "None yet"}</p><p><strong>Still needs to acknowledge:</strong> {update.unacknowledgedNames.length ? update.unacknowledgedNames.join(", ") : "Everyone targeted has acknowledged"}</p></>}
                  </div>
                </details>
              </div>
              {!isArchived && <ActionButton action={deleteGuestUpdateWeb.bind(null, params.id, update.id)} confirm="Remove this update from guest pages? Existing seen history for it will also be removed." className="font-body text-xs text-forest/50 underline decoration-sage/50 underline-offset-4">Remove</ActionButton>}
            </div>
          </article>
        ))}</div>}
      </section>
    </div>
  );
}
