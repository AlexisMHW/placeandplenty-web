"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  addActivityPayment,
  createScheduleActivity,
  deleteActivityPayment,
  deleteScheduleActivity,
  extendMultiDayDuration,
  initializeMultiDaySchedule,
  moveScheduleActivity,
  setActivityVisibleGuests,
  updateScheduleActivity,
  updateScheduleDay,
} from "@/lib/multi-day-actions";
import type { MultiDayWorkspace, ScheduleActivity, ScheduleDay } from "@/lib/multi-day-data";

export default function MultiDayScheduleClient({
  gatheringId,
  gatheringName,
  startDate,
  endDate,
  workspace,
}: {
  gatheringId: string;
  gatheringName: string;
  startDate: string;
  endDate: string | null;
  workspace: MultiDayWorkspace;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  if (!workspace.access.hasPass) {
    return (
      <div className="mt-8 rounded-2xl border border-gold/35 bg-cream p-6">
        <p className="font-body text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest/55">Multi-Day</p>
        <h2 className="mt-2 font-display text-2xl text-forest">Keep the whole gathering together.</h2>
        <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-forest/70">
          This gathering spans multiple days. A Multi-Day Pass keeps one guest list, one plan and one schedule across 2–4 calendar days.
        </p>
        <Link href={`/checkout/multi-day?gatheringId=${gatheringId}`} className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite">
          Get Multi-Day Pass
        </Link>
      </div>
    );
  }

  if (workspace.days.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-sage/25 bg-cream p-6">
        <h2 className="font-display text-2xl text-forest">Build My Schedule</h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
          Create the day-by-day structure for {gatheringName}. Your existing Table, Shopping, contributions and expenses stay where they are and can be linked to a day or activity.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => initializeMultiDaySchedule(gatheringId))}
          className="mt-5 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
        >
          {pending ? "Building…" : "Create schedule"}
        </button>
        {error && <p className="mt-3 font-body text-sm text-error">{error}</p>}
      </div>
    );
  }

  const inclusiveDays = endDate
    ? Math.floor((new Date(endDate + "T00:00:00Z").getTime() - new Date(startDate + "T00:00:00Z").getTime()) / 86400000) + 1
    : workspace.days.length;

  return (
    <div className="mt-8">
      <div className="rounded-2xl border border-sage/25 bg-parchment p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-body text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest/55">My Schedule</p>
            <h2 className="mt-1 font-display text-2xl text-forest">{gatheringName}</h2>
            <p className="mt-2 font-body text-sm text-forest/65">
              {inclusiveDays} calendar days · {workspace.activities.length} {workspace.activities.length === 1 ? "activity" : "activities"}
            </p>
          </div>
          {inclusiveDays >= 4 && !workspace.access.hasExtension && (
            <Link href={`/checkout/multi-day-extension?gatheringId=${gatheringId}`} className="rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest">
              Add days 5–7
            </Link>
          )}
        </div>

        {workspace.access.hasExtension && inclusiveDays < 7 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-sage/20 pt-4">
            <span className="font-body text-sm text-forest/65">Extend to:</span>
            {([5, 6, 7] as const).filter((n) => n > inclusiveDays).map((n) => (
              <button key={n} type="button" disabled={pending} onClick={() => run(() => extendMultiDayDuration(gatheringId, n))} className="rounded-full border border-sage/45 px-3 py-1.5 font-body text-sm text-forest disabled:opacity-50">
                {n} days
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-error/5 px-4 py-3 font-body text-sm text-error">{error}</p>}

      <div className="mt-6 space-y-5">
        {workspace.days.map((day, index) => {
          const activities = workspace.activities.filter((a) => a.gathering_day_id === day.id);
          return (
            <DayCard
              key={day.id}
              gatheringId={gatheringId}
              day={day}
              index={index}
              activities={activities}
              workspace={workspace}
              openActivity={openActivity}
              setOpenActivity={setOpenActivity}
              pending={pending}
              run={run}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCard({
  gatheringId,
  day,
  index,
  activities,
  workspace,
  openActivity,
  setOpenActivity,
  pending,
  run,
}: {
  gatheringId: string;
  day: ScheduleDay;
  index: number;
  activities: ScheduleActivity[];
  workspace: MultiDayWorkspace;
  openActivity: string | null;
  setOpenActivity: (id: string | null) => void;
  pending: boolean;
  run: (a: () => Promise<{ ok: true } | { ok: false; message: string }>) => void;
}) {
  const date = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(day.day_date + "T00:00:00Z"));

  return (
    <section className="overflow-hidden rounded-2xl border border-sage/25 bg-offwhite">
      <header className="border-b border-sage/20 bg-cream px-5 py-4">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/50">Day {index + 1}</p>
        <h3 className="mt-1 font-display text-xl text-forest">{day.title || date}</h3>
        {day.title && <p className="mt-1 font-body text-sm text-forest/60">{date}</p>}
        <details className="mt-3">
          <summary className="cursor-pointer font-body text-xs font-semibold text-forest/65">Edit day details</summary>
          <form
            className="mt-3 grid gap-3"
            action={(form) => run(() => updateScheduleDay(gatheringId, day.id, form))}
          >
            <input name="title" defaultValue={day.title ?? ""} placeholder="Day title (optional)" className="rounded-lg border border-sage/35 bg-white px-3 py-2 font-body text-sm text-forest" />
            <textarea name="notes" defaultValue={day.notes ?? ""} placeholder="Notes for this day" rows={2} className="rounded-lg border border-sage/35 bg-white px-3 py-2 font-body text-sm text-forest" />
            <button disabled={pending} className="justify-self-start rounded-full bg-forest px-4 py-2 font-body text-xs font-semibold text-offwhite disabled:opacity-50">Save day</button>
          </form>
        </details>
      </header>

      <div className="divide-y divide-sage/15">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            gatheringId={gatheringId}
            activity={activity}
            allDays={workspace.days}
            guests={workspace.guests}
            responses={workspace.responses.filter((r) => r.activity_id === activity.id)}
            visibleGuests={workspace.visibleGuests.filter((r) => r.activity_id === activity.id).map((r) => r.gathering_guest_id)}
            payments={workspace.payments.filter((p) => p.activity_id === activity.id)}
            open={openActivity === activity.id}
            toggle={() => setOpenActivity(openActivity === activity.id ? null : activity.id)}
            pending={pending}
            run={run}
          />
        ))}

        <details className="px-5 py-4">
          <summary className="cursor-pointer font-body text-sm font-semibold text-forest">+ Add an activity</summary>
          <ActivityForm
            onSubmit={(form) => run(() => createScheduleActivity(gatheringId, day.id, form))}
            pending={pending}
          />
        </details>
      </div>
    </section>
  );
}

function ActivityCard({
  gatheringId,
  activity,
  allDays,
  guests,
  responses,
  visibleGuests,
  payments,
  open,
  toggle,
  pending,
  run,
}: any) {
  const occupied = responses.filter((r: any) => r.rsvp_status === "yes" || r.selected).length;
  const remaining = activity.capacity == null ? null : Math.max(0, activity.capacity - occupied);

  return (
    <article className="px-5 py-4">
      <button type="button" onClick={toggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h4 className="font-display text-lg text-forest">{activity.title}</h4>
          <p className="mt-1 font-body text-sm text-forest/60">
            {[activity.start_time?.slice(0, 5), activity.location_name].filter(Boolean).join(" · ") || "Details not set yet"}
          </p>
        </div>
        <span className="font-body text-xs text-forest/55">{open ? "Close" : "Manage"}</span>
      </button>

      {activity.capacity != null && (
        <p className="mt-2 font-body text-xs text-forest/55">{remaining === 0 ? "Full" : `${remaining} of ${activity.capacity} spots left`}</p>
      )}

      {open && (
        <div className="mt-5 space-y-6 border-t border-sage/20 pt-5">
          <ActivityForm activity={activity} onSubmit={(form) => run(() => updateScheduleActivity(gatheringId, activity.id, form))} pending={pending} />

          <div>
            <h5 className="font-body text-sm font-bold text-forest">Move to another day</h5>
            <div className="mt-2 flex flex-wrap gap-2">
              {allDays.filter((d: ScheduleDay) => d.id !== activity.gathering_day_id).map((d: ScheduleDay) => (
                <button key={d.id} type="button" disabled={pending} onClick={() => run(() => moveScheduleActivity(gatheringId, activity.id, d.id))} className="rounded-full border border-sage/40 px-3 py-1.5 font-body text-xs text-forest">
                  {d.title || d.day_date}
                </button>
              ))}
            </div>
          </div>

          {activity.guest_visibility === "selected_guests" && (
            <SelectedGuestEditor gatheringId={gatheringId} activityId={activity.id} guests={guests} selected={visibleGuests} pending={pending} run={run} />
          )}

          <div>
            <h5 className="font-body text-sm font-bold text-forest">Guest responses</h5>
            {responses.length === 0 ? (
              <p className="mt-2 font-body text-sm text-forest/55">No activity responses yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {responses.map((r: any) => {
                  const guest = guests.find((g: any) => g.id === r.gathering_guest_id);
                  return <p key={r.gathering_guest_id} className="font-body text-sm text-forest/70">{guest ? guest.first_name + (guest.last_name ? " " + guest.last_name : "") : "Guest"} · {r.selected ? "Selected" : r.rsvp_status}</p>;
                })}
              </div>
            )}
          </div>

          <div>
            <h5 className="font-body text-sm font-bold text-forest">Activity cost tracker</h5>
            {payments.map((p: any) => (
              <div key={p.id} className="mt-2 flex items-center justify-between rounded-lg bg-cream px-3 py-2">
                <p className="font-body text-sm text-forest">{p.label || "Activity cost"} · ${p.amount_paid.toFixed(2)} / ${p.amount_due.toFixed(2)}</p>
                <button type="button" onClick={() => run(() => deleteActivityPayment(gatheringId, p.id))} className="font-body text-xs text-error">Remove</button>
              </div>
            ))}
            <PaymentForm gatheringId={gatheringId} activityId={activity.id} guests={guests} pending={pending} run={run} />
          </div>

          <button type="button" disabled={pending} onClick={() => run(() => deleteScheduleActivity(gatheringId, activity.id))} className="font-body text-sm text-error underline underline-offset-4">
            Delete activity
          </button>
        </div>
      )}
    </article>
  );
}

function ActivityForm({ activity, onSubmit, pending }: { activity?: ScheduleActivity; onSubmit: (form: FormData) => void; pending: boolean }) {
  return (
    <form className="grid gap-3 md:grid-cols-2" action={onSubmit}>
      <input name="title" required defaultValue={activity?.title ?? ""} placeholder="Activity title" className="md:col-span-2 rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input type="time" name="start_time" defaultValue={activity?.start_time?.slice(0, 5) ?? ""} className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input type="time" name="end_time" defaultValue={activity?.end_time?.slice(0, 5) ?? ""} className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="location_name" defaultValue={activity?.location_name ?? ""} placeholder="Location name" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="location_address" defaultValue={activity?.location_address ?? ""} placeholder="Address" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <textarea name="description" defaultValue={activity?.description ?? ""} placeholder="Description" rows={2} className="md:col-span-2 rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="attire_notes" defaultValue={activity?.attire_notes ?? ""} placeholder="Attire" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="transportation_notes" defaultValue={activity?.transportation_notes ?? ""} placeholder="Transportation" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="reservation_notes" defaultValue={activity?.reservation_notes ?? ""} placeholder="Reservation notes" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="capacity" type="number" min={1} defaultValue={activity?.capacity ?? ""} placeholder="Capacity" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="vendor_name" defaultValue={activity?.vendor_name ?? ""} placeholder="Provider / vendor" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="vendor_contact" defaultValue={activity?.vendor_contact ?? ""} placeholder="Provider contact" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <select name="guest_visibility" defaultValue={activity?.guest_visibility ?? "all_invited"} className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm">
        <option value="all_invited">All invited guests</option>
        <option value="accepted_guests">Guests who are coming</option>
        <option value="selected_guests">Selected guests only</option>
      </select>
      <label className="flex items-center gap-2 font-body text-sm text-forest"><input type="checkbox" name="is_selectable" defaultChecked={activity?.is_selectable ?? false} /> Guests can choose this option</label>
      <input name="selection_group" defaultValue={activity?.selection_group ?? ""} placeholder="Selection group (optional)" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <button disabled={pending} className="justify-self-start rounded-full bg-forest px-4 py-2 font-body text-xs font-semibold text-offwhite disabled:opacity-50">{activity ? "Save activity" : "Add activity"}</button>
    </form>
  );
}

function SelectedGuestEditor({ gatheringId, activityId, guests, selected, pending, run }: any) {
  const [ids, setIds] = useState<string[]>(selected);
  return (
    <div>
      <h5 className="font-body text-sm font-bold text-forest">Who can see this activity?</h5>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {guests.map((g: any) => (
          <label key={g.id} className="flex items-center gap-2 font-body text-sm text-forest/75">
            <input type="checkbox" checked={ids.includes(g.id)} onChange={(e) => setIds((cur) => e.target.checked ? [...cur, g.id] : cur.filter((id) => id !== g.id))} />
            {g.first_name}{g.last_name ? " " + g.last_name : ""}
          </label>
        ))}
      </div>
      <button type="button" disabled={pending} onClick={() => run(() => setActivityVisibleGuests(gatheringId, activityId, ids))} className="mt-3 rounded-full border border-forest px-4 py-2 font-body text-xs font-semibold text-forest">Save visibility</button>
    </div>
  );
}

function PaymentForm({ gatheringId, activityId, guests, pending, run }: any) {
  return (
    <form className="mt-3 grid gap-2 md:grid-cols-2" action={(form) => run(() => addActivityPayment(gatheringId, activityId, form))}>
      <select name="gathering_guest_id" defaultValue="" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm">
        <option value="">Choose a guest</option>
        {guests.map((g: any) => <option key={g.id} value={g.id}>{g.first_name}{g.last_name ? " " + g.last_name : ""}</option>)}
      </select>
      <input name="label" placeholder="What this is for" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="amount_due" type="number" min="0" step="0.01" placeholder="Amount due" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <input name="amount_paid" type="number" min="0" step="0.01" placeholder="Amount paid" className="rounded-lg border border-sage/35 px-3 py-2 font-body text-sm" />
      <button disabled={pending} className="justify-self-start rounded-full border border-forest px-4 py-2 font-body text-xs font-semibold text-forest">Add cost</button>
    </form>
  );
}
