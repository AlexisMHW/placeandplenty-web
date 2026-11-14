import { requireStaff } from "@/lib/admin/server";
import { hcCapabilities, parseSubmissions } from "@/lib/admin/hc";
import { ActionForm } from "@/components/hc/ActionForm";
import { reviewSubmissionForm } from "../form-actions";

// CONTENT SUBMISSIONS. "Usage permissions" shows only rights the creator has actively granted for that piece. No row = no rights.
export default async function ContentPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/content");
  const caps = hcCapabilities(context);
  const { data, error } = await supabase.rpc("hc_admin_list_submissions", { p_status: null });
  const rows = error ? null : parseSubmissions(data);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Content submissions</h1>
      {rows === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No submissions yet.</p>
      ) : (
        <ul className="space-y-3">{rows.map((s) => (
          <li key={s.id} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
            <p><span className="font-medium">{s.displayName}</span> on {s.platform}: <a href={s.url} rel="noopener noreferrer nofollow" target="_blank" className="underline">{s.url}</a></p>
            <p className="text-charcoal/70">Status: {s.status.replace("_", " ")}. Usage permissions granted: {s.activePermissions.length ? s.activePermissions.join(", ").replace(/_/g, " ") : "none (no rights to reuse this piece)"}.</p>
            {caps.canReviewContent ? (
              <ActionForm action={reviewSubmissionForm} buttons={[{ label: "Approve", name: "decision", value: "approved" }, { label: "Request changes", name: "decision", value: "changes_requested", secondary: true }, { label: "Reject", name: "decision", value: "rejected", secondary: true }]} className="mt-2 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={s.id} />
                <label className="text-xs">Note<input name="note" maxLength={1000} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
              </ActionForm>
            ) : null}
          </li>))}
        </ul>
      )}
    </div>
  );
}
