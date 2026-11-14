import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities, parseMembers } from "@/lib/admin/hc";
import { parseCampaigns } from "@/lib/admin/campaigns";
import { parseTiers } from "@/lib/hc/tiers";
import { ActionForm } from "@/components/hc/ActionForm";
import { assignCampaignForm, setMemberStatusForm, setMemberTierForm } from "../form-actions";

// MEMBERS. hc.read to see. Tier, suspend/reinstate and campaign-assignment controls render only for hc.manage, and the database checks it again,
// writes the audit row, and emits the inbox event. A member with no tier is a "basic member": portal and code, no paid terms (commissions held).
export default async function MembersPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/members");
  const caps = hcCapabilities(context);
  const [membersRes, tiersRes, campsRes] = await Promise.all([
    supabase.rpc("hc_admin_list_members"), supabase.rpc("hc_admin_list_tiers"), supabase.rpc("hc_admin_list_campaigns"),
  ]);
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
      <p className="text-xs text-charcoal/70">Suspending pauses the member&apos;s portal and new campaigns. Reinstating restores the previous tier. Both are recorded in the tier history. Neither changes any commission already recorded.</p>
    </div>
  );
}
