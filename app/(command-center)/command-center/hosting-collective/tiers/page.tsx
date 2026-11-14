import { requireStaff } from "@/lib/admin/server";
import { dollars, hcCapabilities, parseMembers } from "@/lib/admin/hc";
import { parseConfigAudit, parseTermsHistory, parseTiers } from "@/lib/admin/tiers";
import { ActionForm } from "../../_components/action-form";
import { assignTier, saveTier, setPartnerStatus } from "./actions";

// TIERS, MEMBER STATUS, REFERRAL ELIGIBILITY AND COMMISSION VERSIONS (founder decision D4). Read: hc.read. Changes: hc.manage (re-checked in the database).
// No tier names, benefits or rates are pre-filled: the owner defines them. Paid referrals stay OFF; nothing on this page turns them on.
// Adding a new commission-terms version is owner-only and lives on the Payouts page; its history is listed here.
export default async function TiersPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/tiers");
  const caps = hcCapabilities(context);
  const [tiersRes, termsRes, histRes, membersRes] = await Promise.all([
    supabase.rpc("hc_admin_list_tiers"), supabase.rpc("hc_admin_terms_history"), supabase.rpc("hc_admin_config_audit", { p_entity: null, p_limit: 80 }), supabase.rpc("hc_admin_list_members"),
  ]);
  const tiers = tiersRes.error ? null : parseTiers(tiersRes.data);
  const terms = termsRes.error ? null : parseTermsHistory(termsRes.data);
  const history = histRes.error ? null : parseConfigAudit(histRes.data);
  const members = membersRes.error ? null : parseMembers(membersRes.data);
  const field = "ml-1 rounded border border-forest/30 px-2 py-1";
  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-forest">Tiers, members and commission versions</h1>
      <p className="text-sm text-charcoal/80">Tiers are whatever you define here. Members without a tier are basic members and earn nothing until you decide. Paid referrals stay off; this page cannot turn them on.</p>

      <section aria-labelledby="tiers">
        <h2 id="tiers" className="mb-2 font-display text-xl text-forest">Tiers</h2>
        {tiers === null ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the tier database package is applied.</p> : tiers.length === 0 ? <p className="text-sm text-charcoal/70">No tiers defined yet. Members are basic members.</p> : (
          <ul className="space-y-3 text-sm">{tiers.map((t) => (
            <li key={t.slug} className="rounded-lg border border-forest/15 bg-parchment p-3">
              <p><span className="font-medium">{t.label}</span> <span className="text-charcoal/60">({t.slug})</span> — {t.active ? "active" : "switched off"} · {t.memberCount} approved member(s) · paid-referral eligible: {t.paidReferralsEligible ? "yes" : "no"}</p>
              {t.description ? <p className="mt-1 text-charcoal/80">{t.description}</p> : null}
              {t.benefits.length ? <ul className="mt-1 list-disc pl-5 text-charcoal/80">{t.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul> : <p className="mt-1 text-xs text-charcoal/60">No benefits listed.</p>}
              {t.eligibilityNotes ? <p className="mt-1 text-xs text-charcoal/70">Eligibility: {t.eligibilityNotes}</p> : null}
            </li>))}</ul>)}
        {caps.canManage ? (
          <ActionForm action={saveTier} submitLabel="Save tier" className="mt-4 space-y-2 rounded-lg border border-forest/15 p-4 text-sm" successText="Tier saved and recorded in the history below.">
            <h3 className="font-display text-lg text-forest">Add or change a tier</h3>
            <label className="block">Key (lower-case letters, numbers, dashes; reuse a key to change that tier)<input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" className={`${field} w-full`} /></label>
            <label className="block">Name members see<input name="label" required minLength={2} maxLength={60} className={`${field} w-full`} /></label>
            <label className="block">Description<textarea name="description" maxLength={400} rows={2} className={`${field} w-full`} /></label>
            <label className="block">Benefits (one per line, up to 12)<textarea name="benefits" rows={4} className={`${field} w-full`} /></label>
            <label className="block">Who qualifies (notes for you and reviewers)<textarea name="eligibility_notes" maxLength={400} rows={2} className={`${field} w-full`} /></label>
            <label className="inline-block">Order<input name="sort_order" inputMode="numeric" defaultValue="0" className={`${field} w-16`} /></label>
            <label className="ml-4"><input type="checkbox" name="active" value="yes" defaultChecked /> Active</label>
            {context.permissions.includes("hc.payout") ? <label className="ml-4"><input type="checkbox" name="paid_referrals_eligible" value="yes" /> Members on this tier may earn paid referrals (owner only; has no effect until the paid referrals switch is on)</label> : <p className="text-xs text-charcoal/70">Only the owner can make a tier eligible for paid referrals.</p>}
            <label className="block">Reason for this change (kept in the history)<input name="reason" required minLength={3} maxLength={200} className={`${field} w-full`} /></label>
          </ActionForm>) : null}
      </section>

      <section aria-labelledby="members">
        <h2 id="members" className="mb-2 font-display text-xl text-forest">Member tier and status</h2>
        {members === null ? <p role="status" className="text-sm text-charcoal/70">Not available.</p> : members.length === 0 ? <p className="text-sm text-charcoal/70">No members yet.</p> : (
          <ul className="space-y-3 text-sm">{members.map((m) => (
            <li key={m.partnerId} className="rounded-lg border border-forest/15 p-3">
              <p>{m.displayName} — {m.status} · tier: {m.tier ?? "none (basic member)"}</p>
              {caps.canManage && (m.status === "approved" || m.status === "suspended") ? (
                <div className="mt-2 flex flex-wrap gap-4">
                  {m.status === "approved" ? (
                    <ActionForm action={assignTier} submitLabel="Set tier" className="flex flex-wrap items-end gap-2" successText="Tier updated.">
                      <input type="hidden" name="partner_id" value={m.partnerId} />
                      <label className="text-xs">Tier (blank = basic member)<select name="tier" defaultValue={m.tier ?? ""} className={field}><option value="">basic member</option>{(tiers ?? []).filter((t) => t.active || t.slug === m.tier).map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}</select></label>
                      <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className={field} /></label>
                    </ActionForm>) : null}
                  <ActionForm action={setPartnerStatus} submitLabel={m.status === "approved" ? "Suspend member" : "Reinstate member"} submitClassName="rounded border border-forest/30 px-3 py-1 text-forest" className="flex flex-wrap items-end gap-2" successText="Status updated. Earned commissions are unchanged.">
                    <input type="hidden" name="partner_id" value={m.partnerId} /><input type="hidden" name="status" value={m.status === "approved" ? "suspended" : "approved"} />
                    <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className={field} /></label>
                  </ActionForm>
                </div>) : null}
            </li>))}</ul>)}
      </section>

      <section aria-labelledby="terms">
        <h2 id="terms" className="mb-2 font-display text-xl text-forest">Commission terms versions</h2>
        <p className="mb-2 text-sm text-charcoal/70">Each change is a new version with a future start time. Earned commissions keep the version they were earned under.</p>
        {terms === null ? <p role="status" className="text-sm text-charcoal/70">Not available.</p> : terms.length === 0 ? <p className="text-sm text-charcoal/70">No terms defined yet. No commission is earned until you define them.</p> : (
          <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
            <thead className="bg-cream"><tr>{["Version", "Starts", "Validation days", "Minimum payout", "Amounts", "Note"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>{terms.map((v) => (
              <tr key={v.version} className="border-t border-forest/10"><td className="px-3 py-2">{v.version}{v.inForce ? " (in force)" : ""}</td><td className="px-3 py-2">{v.effectiveFrom ? v.effectiveFrom.slice(0, 16).replace("T", " ") + " UTC" : "n/a"}</td>
                <td className="px-3 py-2 tabular-nums">{v.validationDays ?? "n/a"}</td><td className="px-3 py-2 tabular-nums">{dollars(v.minPayoutCents)}</td>
                <td className="px-3 py-2">{Object.entries(v.amounts).map(([k, c]) => `${k.replace(/_/g, " ")}: ${dollars(c)}`).join(", ") || "none"}</td><td className="px-3 py-2">{v.note ?? ""}</td></tr>))}</tbody></table></div>)}
        {context.permissions.includes("hc.payout") ? <p className="mt-2 text-sm">Add a new version on the <a className="text-forest underline" href="/command-center/hosting-collective/payouts">Payouts page</a>.</p> : null}
      </section>

      <section aria-labelledby="hist">
        <h2 id="hist" className="mb-2 font-display text-xl text-forest">Change history (tiers, member tiers and status, terms, paid-referrals switch)</h2>
        {history === null ? <p role="status" className="text-sm text-charcoal/70">Not available.</p> : history.length === 0 ? <p className="text-sm text-charcoal/70">No changes yet.</p> : (
          <ol className="space-y-1 text-sm">{history.map((h) => <li key={h.id}>{h.at ? `${h.at.slice(0, 16).replace("T", " ")} UTC — ` : ""}{h.label} {h.action}{h.summary ? ` (${h.summary})` : ""}{h.reason ? ` — reason: ${h.reason}` : ""}</li>)}</ol>)}
      </section>
    </div>
  );
}
