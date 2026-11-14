import { requireStaff } from "@/lib/admin/server";
import { deliveryLabel, parseDeliveries, parseSettings } from "@/lib/admin/notifications";
import { ActionForm } from "../../_components/action-form";
import { retryDelivery, setDestination, setEmailEnabled, setThresholds, verifyDestination } from "../actions";

// NOTIFICATION SETTINGS (decision D5, channel B). Anyone with ops.read can see the state and the delivery log (the address is shown masked unless they
// also hold staff.manage). Only staff.manage (owner) can change the address, verify it, switch email on, change thresholds or retry a failed email.
// The address is a CONFIGURATION VALUE typed here; it is not in source code. Email stays off until the address is verified; a verification code is sent
// to it and never shown on screen. Sending itself is a separate flag-controlled job: this screen shows queued / sent / delivered separately.
export default async function NotificationSettingsPage() {
  const { context, supabase } = await requireStaff("ops.read", "/command-center/inbox/settings");
  const [sRes, dRes] = await Promise.all([supabase.rpc("admin_get_notification_settings"), supabase.rpc("admin_list_notification_deliveries", { p_status: null, p_limit: 50 })]);
  const s = sRes.error ? null : parseSettings(sRes.data);
  const deliveries = dRes.error ? null : parseDeliveries(dRes.data);
  const canManage = context.permissions.includes("staff.manage");
  const f = "ml-1 rounded border border-forest/30 px-2 py-1";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Notification settings</h1>
      <p className="text-sm text-charcoal/80">Every notification appears in your Inbox. Optionally, important ones can also be emailed to one business address. Emails contain no names, email addresses or amounts, only that something needs attention and a link back here.</p>
      {s === null ? <p role="alert" className="rounded-lg border border-error/40 bg-cream p-4 text-sm">Settings are not available right now (the notification database package may not be applied yet).</p> : (
        <>
          <section aria-labelledby="dest" className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
            <h2 id="dest" className="font-display text-lg text-forest">Email address</h2>
            <p className="mt-1">Address: <span className="font-medium">{s.destination ?? "not set"}</span> — {s.destinationStatus === "verified" ? `verified${s.verifiedAt ? " on " + s.verifiedAt.slice(0, 10) : ""}` : s.destinationStatus === "pending_verification" ? "waiting for the code" : "not set up"}</p>
            <p>Email notifications: <span className="font-medium">{s.emailEnabled ? `ON (${s.minSeverity} and above)` : "OFF"}</span>{s.emailPendingCount > 0 ? ` · ${s.emailPendingCount} waiting to be sent` : ""}</p>
            <p className="mt-1 text-xs text-charcoal/70">Sending real email is controlled separately and stays off until delivery is verified and approved. Until then emails are only queued.</p>
            {canManage ? (
              <div className="mt-3 space-y-3">
                <ActionForm action={setDestination} submitLabel={s.destination ? "Change address and send a code" : "Set address and send a code"} className="flex flex-wrap items-end gap-2 text-xs" successText="Saved. A code was queued for that address. Enter it below once it arrives. Email stays off until then.">
                  <label>Business email address<input name="email" type="email" required maxLength={254} autoComplete="off" className={`${f} w-64`} /></label></ActionForm>
                {s.destinationStatus === "pending_verification" ? (
                  <ActionForm action={verifyDestination} submitLabel="Verify" className="flex flex-wrap items-end gap-2 text-xs" successText="Address verified.">
                    <label>8-character code from the email<input name="code" required pattern="[0-9a-fA-F]{8}" autoComplete="off" className={`${f} w-32`} /></label></ActionForm>) : null}
                <ActionForm action={setEmailEnabled} submitLabel="Save email setting" className="flex flex-wrap items-end gap-3 text-xs" successText="Email setting saved.">
                  <label><input type="checkbox" name="enabled" value="yes" defaultChecked={s.emailEnabled} disabled={s.destinationStatus !== "verified"} /> Email me important notifications{s.destinationStatus !== "verified" ? " (verify the address first)" : ""}</label>
                  <label>Send from<select name="min_severity" defaultValue={s.minSeverity} className={f}><option value="info">everything (info and above)</option><option value="warning">warnings and critical</option><option value="critical">critical only</option></select></label></ActionForm>
                <ActionForm action={setThresholds} submitLabel="Save reminder windows" className="flex flex-wrap items-end gap-3 text-xs" successText="Reminder windows saved.">
                  <label>Remind me of applications waiting more than (hours)<input name="awaiting_review_hours" required inputMode="numeric" defaultValue={s.awaitingReviewHours} className={`${f} w-16`} /></label>
                  <label>Payout drafts waiting more than (hours)<input name="payout_approval_hours" required inputMode="numeric" defaultValue={s.payoutApprovalHours} className={`${f} w-16`} /></label></ActionForm>
              </div>) : <p className="mt-2 text-xs text-charcoal/70">Only the owner can change these settings.</p>}
          </section>
          <section aria-labelledby="log">
            <h2 id="log" className="mb-2 font-display text-lg text-forest">Email delivery log</h2>
            <p className="mb-2 text-xs text-charcoal/70">Queued is not sent, and sent is not delivered. Each line says exactly which one happened.</p>
            {deliveries === null ? <p role="status" className="text-sm text-charcoal/70">Not available.</p> : deliveries.length === 0 ? <p className="text-sm text-charcoal/70">No emails yet.</p> : (
              <ul className="space-y-2 text-sm">{deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2 rounded border border-forest/10 px-3 py-2">
                  <span>{d.kind === "verification" ? "Verification code" : d.title ?? "Notification"}</span><span className="text-charcoal/70">— {deliveryLabel(d.status)}</span>
                  <span className="text-xs text-charcoal/60">attempts {d.attempts}{d.lastError ? ` · ${d.lastError}` : ""}{d.queuedAt ? ` · queued ${d.queuedAt.slice(0, 16).replace("T", " ")} UTC` : ""}</span>
                  {canManage && d.retryable ? <ActionForm action={retryDelivery} submitLabel="Retry" submitClassName="rounded border border-forest/30 px-2 py-0.5 text-forest" successText="Queued again."><input type="hidden" name="id" value={d.id} /></ActionForm> : null}
                </li>))}</ul>)}
          </section>
        </>)}
    </div>
  );
}
