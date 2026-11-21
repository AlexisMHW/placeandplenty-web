import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities, parseAnnouncements } from "@/lib/admin/hc";
import { parseTiers } from "@/lib/admin/tiers";
import { ActionForm } from "../../_components/action-form";
import { publishAnnouncement, retractAnnouncement } from "./actions";

// ANNOUNCEMENTS. Member community access: a short post shown to every approved member (or one tier) at the top of their /creator page.
// Nothing is sent by email or text. Retracting hides it from members; the record stays. Read: hc.read. Publish / retract: hc.manage.
export default async function AnnouncementsPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/announcements");
  const caps = hcCapabilities(context);
  const [annRes, tiersRes] = await Promise.all([supabase.rpc("hc_admin_list_announcements"), supabase.rpc("hc_admin_list_tiers")]);
  const rows = annRes.error ? null : parseAnnouncements(annRes.data);
  const tiers = tiersRes.error ? [] : parseTiers(tiersRes.data) ?? [];
  const field = "mt-1 w-full rounded border border-forest/30 px-2 py-1";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Member announcements</h1>
      <p className="text-sm text-charcoal/80">Shown to approved members on their creator page. Nothing is emailed or texted.</p>
      {caps.canManage ? (
        <section aria-labelledby="new">
          <h2 id="new" className="mb-2 font-display text-xl text-forest">New announcement</h2>
          <ActionForm action={publishAnnouncement} submitLabel="Publish" className="max-w-xl space-y-2" successText="Published. Members see it the next time they open their page.">
            <label className="block text-sm">Title<input name="title" required maxLength={120} className={field} /></label>
            <label className="block text-sm">Message<textarea name="body" required maxLength={2000} rows={4} className={field} /></label>
            <label className="block text-sm">Audience
              <select name="tier" className={field}><option value="">All approved members</option>{tiers.map((t) => <option key={t.slug} value={t.slug}>{t.label} only</option>)}</select>
            </label>
          </ActionForm>
        </section>) : null}
      <section aria-labelledby="all">
        <h2 id="all" className="mb-2 font-display text-xl text-forest">Published and retracted</h2>
        {rows === null ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the announcements database package is applied.</p>
          : rows.length === 0 ? <p className="text-sm text-charcoal/70">No announcements yet.</p> : (
          <ul className="space-y-3 text-sm">{rows.map((a) => (
            <li key={a.id} className="rounded-lg border border-forest/15 bg-parchment p-3">
              <p className="font-medium">{a.title} <span className="text-charcoal/70">({a.published ? "visible" : "retracted"}; {a.tierSlug ? `tier ${a.tierSlug}` : "all members"})</span></p>
              <p className="mt-1 whitespace-pre-line text-charcoal/80">{a.body}</p>
              {caps.canManage && a.published ? <ActionForm action={retractAnnouncement} submitLabel="Retract" submitClassName="mt-2 rounded border border-forest/30 px-3 py-1 text-forest" successText="Retracted."><input type="hidden" name="id" value={a.id} /></ActionForm> : null}
            </li>))}</ul>)}
      </section>
    </div>
  );
}
