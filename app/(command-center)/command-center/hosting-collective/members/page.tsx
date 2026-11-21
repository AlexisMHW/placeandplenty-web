import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities, parseMembers } from "@/lib/admin/hc";
import { parseCampaigns } from "@/lib/admin/campaigns";
import { parseTiers } from "@/lib/hc/tiers";
import { ActionForm } from "@/components/hc/ActionForm";
import { parseMembershipOverview } from "@/lib/hc/membership";
import { assignCampaignForm, setMemberStatusForm, setMemberTierForm, setReapplyForm, sweepDraftsForm } from "../form-actions";

// MEMBERS. hc.read to see. Tier, suspend/reinstate and campaign-assignment controls render only for hc.manage, and the database checks it again,
// writes the audit row, and emits the inbox event. A member with no tier is a "basic member": portal and code, no paid terms (commissions held).
export default async function MembersPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/members");
  const caps = hcCapabilities(context);
  const [membersRes, tiersRes, campsRes, overviewRes] = await Promise.all([
    supabase.rpc("hc_admin_list_members"), supabase.rpc("hc_admin_list_tiers"), supabase.rpc("hc_admin_list_campaigns"), supabase.rpc("hc_admin_membership_overview"),
  ]);
  const overview = overviewRes.error ? null : parseMembershipOverview(overviewRes.data);
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "n/a");
  const rows = membersRes.error ? null : parseMembers(membersRes.data);
  const tiers = tiersRes.error ? [] : (parseTiers(tiersRes.data) ?? []).filter((t) => t.active);
  const openCamps = campsRes.error ? [] : (parseCampaigns(campsRes.data) ?? []).filter((c) => c.status === "open");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Members</h1>
      {rows === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No members yet.</p>
      ) : (
        <ul className="space-y-3">{rows.map((m) => (
          <li key={m.partnerId} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-lg text-forest">{m.displayName}</p>
              <p className="font-medium">{m.status}</p>
            </div>
            <p className="text-charcoal/70">Tier: {m.tier ?? "none (basic member)"} · Account linked: {m.accountLinked ? "yes" : "not yet"} · Codes: {m.codes ?? "n/a"} · Referred sign-ups: {m.signups ?? "n/a"} · Onboarding steps done: {m.onboardingDone ?? "n/a"} · Submissions: {m.submissions ?? "n/a"}</p>
            {caps.canManage ? (
              <div className="mt-3 space-y-2">
                {m.status === "approved" ? (
                  <ActionForm action={setMemberTierForm} buttons={[{ label: "Save tier", secondary: true }]} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="partner_id" value={m.partnerId} />
                    <label className="text-xs">Tier<select name="tier" defaultValue={m.tier ?? ""} className="ml-1 rounded border border-forest/30 px-2 py-1"><option value="">None (basic member)</option>{tiers.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}</select></label>
                  </ActionForm>) : null}
                {m.status === "approved" && openCamps.length ? (
                  <ActionForm action={assignCampaignForm} buttons={[{ label: "Assign", secondary: true }]} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="partner_id" value={m.partnerId} />
                    <label className="text-xs">Campaign<select name="campaign_id" className="ml-1 rounded border border-forest/30 px-2 py-1">{openCamps.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
                  </ActionForm>) : null}
                {m.status === "approved" ? (
                  <ActionForm action={setMemberStatusForm} buttons={[{ label: "Suspend member", secondary: true }]}><input type="hidden" name="partner_id" value={m.partnerId} /><input type="hidden" name="status" value="suspended" /></ActionForm>) : null}
                {m.status === "suspended" ? (
                  <ActionForm action={setMemberStatusForm} buttons={[{ label: "Reinstate member" }]}><input type="hidden" name="partner_id" value={m.partnerId} /><input type="hidden" name="status" value="approved" /></ActionForm>) : null}
              </div>) : null}
          </li>))}</ul>
      )}
      {overview ? (
        <section aria-labelledby="mship" className="space-y-4 border-t border-forest/10 pt-4 text-sm">
          <h2 id="mship" className="font-display text-xl text-forest">Membership rules</h2>
          <div>
            <h3 className="font-medium">Members who left the Collective ({overview.leftMembers.length})</h3>
            {overview.leftMembers.length === 0 ? <p className="text-charcoal/70">None.</p> : (
              <ul className="list-disc pl-5">{overview.leftMembers.map((m) => (
                <li key={m.partnerId}>{m.displayName} left on {day(m.leftAt)}{m.tier ? ` (was ${m.tier})` : ""}. {m.outstandingCommissions ? "Has commissions not yet paid out; they stay on the ledger under the program terms. No payout can be drafted while the member is not active." : "No unpaid commissions."}</li>))}</ul>)}
          </div>
          <div>
            <h3 className="font-medium">Saved application drafts ({overview.drafts.length})</h3>
            <p className="text-xs text-charcoal/70">A draft is notified {overview.settings.draftNoticeDays} days before it expires after {overview.settings.draftExpiryDays} days without edits; expiry removes the saved content. Submitted applications and approved memberships never expire here.</p>
            {overview.drafts.length === 0 ? <p className="text-charcoal/70">None.</p> : (
              <ul className="list-disc pl-5">{overview.drafts.map((d) => (
                <li key={d.draftId}>Last edited {day(d.updatedAt)}; {d.expiredAt ? `expired ${day(d.expiredAt)}` : `expires ${day(d.expiresAt)}`}{d.noticeQueuedAt && !d.expiredAt ? "; notice queued" : ""}.</li>))}</ul>)}
            {caps.canManage ? <ActionForm action={sweepDraftsForm} buttons={[{ label: "Run draft expiry now", secondary: true }]} className="mt-2" /> : null}
          </div>
          <div>
            <h3 className="font-medium">Declined applicants and re-applying ({overview.declined.length})</h3>
            <p className="text-xs text-charcoal/70">A declined applicant can re-apply after {overview.settings.reapplyWaitDays} days unless restricted here. Their form reply stays neutral either way.</p>
            {overview.declined.length === 0 ? <p className="text-charcoal/70">None.</p> : (
              <ul className="space-y-2">{overview.declined.map((a) => (
                <li key={a.applicationId} className="rounded border border-forest/15 p-2">
                  <p>{a.fullName}: declined {day(a.decidedAt)}. {a.override === "blocked" ? "Re-applying is restricted." : a.override === "allowed" ? "Staff allowed re-applying now." : `May re-apply after ${day(a.eligibleAfter)}.`}</p>
                  {caps.canManage ? (
                    <ActionForm action={setReapplyForm} buttons={[{ label: "Restrict", name: "mode", value: "blocked", secondary: true }, { label: "Allow now", name: "mode", value: "allowed", secondary: true }, { label: "Back to default", name: "mode", value: "default", secondary: true }]} className="mt-1 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="application_id" value={a.applicationId} />
                      <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={500} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                    </ActionForm>) : null}
                </li>))}</ul>)}
          </div>
        </section>) : null}
      <p className="text-xs text-charcoal/70">Suspending pauses the member&apos;s portal and new campaigns. Reinstating restores the previous tier. Both are recorded in the tier history. Neither changes any commission already recorded.</p>
    </div>
  );
}
