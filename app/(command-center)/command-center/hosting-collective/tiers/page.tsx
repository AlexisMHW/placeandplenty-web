import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities } from "@/lib/admin/hc";
import { parseTiers } from "@/lib/hc/tiers";
import { ActionForm } from "@/components/hc/ActionForm";
import { upsertTierForm } from "../form-actions";

// MEMBERSHIP TIERS (D4). hc.read to see; create/edit for hc.manage; turning "paid referrals" on or off is owner-only (hc.payout), enforced in the database.
// Nothing is prefilled and no tier, benefit, rate or commission exists until staff type it. Commission amounts are NOT set here: they live only in the
// owner's versioned terms on the Referrals page. Paid referrals also need the program switch and the referral flag; this checkbox alone never pays anything.
export default async function TiersPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/tiers");
  const caps = hcCapabilities(context);
  const [tiersRes, auditRes] = await Promise.all([supabase.rpc("hc_admin_list_tiers"), supabase.rpc("hc_admin_tier_audit", { p_limit: 25 })]);
  const tiers = tiersRes.error ? null : parseTiers(tiersRes.data);
  const audit = auditRes.error || !Array.isArray(auditRes.data) ? [] : (auditRes.data as { id: number; action: string; tier_slug: string | null; created_at: string }[]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Membership tiers</h1>
      <p className="text-sm text-charcoal/70">A member with no tier is a basic member: creator page and referral link only, no paid terms. Tiers decide what a member can see and do. They never set a commission rate.</p>
      {tiers === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : (
        <>
          {tiers.length === 0 ? <p className="text-sm text-charcoal/70">No tiers are defined yet. Members are basic members until you create one.</p> : (
            <ul className="space-y-4">{tiers.map((t) => (
              <li key={t.slug} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
                <p className="font-display text-lg text-forest">{t.label} <span className="text-xs text-charcoal/60">({t.slug}, {t.members} member{t.members === 1 ? "" : "s"}{t.active ? "" : ", inactive"})</span></p>
                {caps.canManage ? <TierForm t={t} owner={caps.canSeePayoutActions} /> : <p className="mt-1 text-charcoal/70">Campaigns: {t.assignmentsEnabled ? "allowed" : "not allowed"} · Paid referrals: {t.referralEligible ? "eligible" : "not eligible"}</p>}
              </li>))}</ul>)}
          {caps.canManage ? (
            <section aria-labelledby="new-tier"><h2 id="new-tier" className="mb-2 font-display text-xl text-forest">New tier</h2><TierForm t={null} owner={caps.canSeePayoutActions} /></section>) : null}
          <section aria-labelledby="hist"><h2 id="hist" className="mb-2 font-display text-xl text-forest">Recent changes</h2>
            {audit.length === 0 ? <p className="text-sm text-charcoal/70">No changes yet.</p> : <ul className="space-y-1 text-sm">{audit.map((a) => <li key={a.id}>{a.created_at?.slice(0, 16).replace("T", " ")} UTC: {a.action.replace(/_/g, " ")}{a.tier_slug ? ` (${a.tier_slug})` : ""}</li>)}</ul>}
          </section>
        </>)}
    </div>
  );
}

function TierForm({ t, owner }: { t: ReturnType<typeof parseTiers> extends (infer R)[] | null ? R | null : never; owner: boolean }) {
  const inp = "mt-1 w-full rounded border border-forest/30 px-2 py-1";
  return (
    <ActionForm action={upsertTierForm} buttons={[{ label: t ? "Save tier" : "Create tier" }]} className="mt-2 space-y-2 text-sm">
      {t ? <input type="hidden" name="slug" value={t.slug} /> : <label className="block">Id (lowercase letters, numbers, underscores)<input name="slug" required pattern="[a-z0-9_]{2,32}" className={inp} /></label>}
      <label className="block">Name<input name="label" required minLength={2} maxLength={60} defaultValue={t?.label ?? ""} className={inp} /></label>
      <label className="block">Description shown to members (optional)<textarea name="description" maxLength={600} rows={2} defaultValue={t?.description ?? ""} className={inp} /></label>
      <label className="block">Eligibility notes (internal)<textarea name="eligibility_notes" maxLength={600} rows={2} defaultValue={t?.eligibilityNotes ?? ""} className={inp} /></label>
      <label className="block">Benefits shown to members (one per line, up to 12; type only what you will honor)<textarea name="benefits" rows={3} defaultValue={t?.benefits.join("\n") ?? ""} className={inp} /></label>
      <label className="block">Sort order<input name="sort_order" inputMode="numeric" defaultValue={t?.sortOrder ?? 100} className="ml-1 w-20 rounded border border-forest/30 px-2 py-1" /></label>
      <div className="flex flex-wrap gap-4 text-xs">
        <label><input type="checkbox" name="active" defaultChecked={t?.active ?? true} /> Active</label>
        <label><input type="checkbox" name="assignments_enabled" defaultChecked={t?.assignmentsEnabled ?? true} /> Can be assigned campaigns</label>
        <label title={owner ? "" : "Owner only"}><input type="checkbox" name="referral_eligible" defaultChecked={t?.referralEligible ?? false} disabled={!owner} /> Eligible for paid referrals (owner only)</label>
      </div>
      {!owner && t?.referralEligible ? <input type="hidden" name="referral_eligible" value="on" /> : null}
      {!owner ? <p className="text-xs text-charcoal/70">Only the owner can change paid-referral eligibility; it is left as it is when you save.</p> : null}
    </ActionForm>
  );
}
