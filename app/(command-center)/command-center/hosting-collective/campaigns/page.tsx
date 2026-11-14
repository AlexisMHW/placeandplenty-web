import { requireStaff } from "@/lib/admin/server";
import { ActionForm } from "../../_components/action-form";
import { hcCapabilities } from "@/lib/admin/hc";
import { NICHES, parseCampaigns } from "@/lib/admin/campaigns";
import { closeCampaign, createCampaign } from "./actions";

// CAMPAIGNS AND CHALLENGES (skeleton). hc.read to see; create/close render only for hc.manage and the database enforces it again.
// Assigning a campaign to a member is done from the member list (needs the member id); this page lists, creates and closes.
// Compensation is optional free text typed by staff. Nothing here sets a rate, a fee or a legal term.
export default async function CampaignsPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/campaigns");
  const caps = hcCapabilities(context);
  const { data, error } = await supabase.rpc("hc_admin_list_campaigns");
  const rows = error ? null : parseCampaigns(data);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Campaigns and challenges</h1>
      {rows === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No campaigns yet.</p>
      ) : (
        <ul className="space-y-3">{rows.map((c) => (
          <li key={c.id} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-display text-lg text-forest">{c.title}</p><p className="text-charcoal/70">{c.status}</p></div>
            <p className="mt-1">{c.brief}</p>
            <p className="mt-1 text-charcoal/70">Niche: {c.niche ? c.niche.replace(/_/g, " ") : "any"} · Members assigned: {c.assigned ?? "n/a"} · Compensation: {c.hasCompensation ? "stated in brief" : "none offered"}</p>
            {caps.canManage && c.status !== "closed" ? (
              <ActionForm action={closeCampaign} submitLabel="Close" submitClassName="rounded border border-forest/30 px-3 py-1 text-forest" className="mt-2" successText="Campaign closed."><input type="hidden" name="campaign_id" value={c.id} /></ActionForm>
            ) : null}
          </li>))}</ul>
      )}
      {caps.canManage ? (
        <ActionForm action={createCampaign} submitLabel="Create draft" className="space-y-2 rounded-lg border border-forest/15 p-4 text-sm" successText="Draft created.">
          <h2 className="font-display text-xl text-forest">New campaign or challenge</h2>
          <label className="block">Title<input name="title" required minLength={2} maxLength={120} className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
          <label className="block">Brief<textarea name="brief" required minLength={10} maxLength={4000} rows={4} className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
          <label className="block">Niche (optional)<select name="niche" className="mt-1 rounded border border-forest/30 px-2 py-1"><option value="">Any</option>{NICHES.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ")}</option>)}</select></label>
          <label className="block">Compensation wording (optional, shown to members exactly as typed)<textarea name="compensation_terms" maxLength={1000} rows={2} className="mt-1 w-full rounded border border-forest/30 px-2 py-1" /></label>
        </ActionForm>
      ) : null}
    </div>
  );
}
