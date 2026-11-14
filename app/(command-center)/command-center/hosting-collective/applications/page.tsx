import { requireStaff } from "@/lib/admin/server";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { hcCapabilities, parseApplications } from "@/lib/admin/hc";
import { reviewApplication } from "../actions";

// APPLICATIONS QUEUE. hc.read to see (emails are masked by the database unless the caller has hc.manage);
// approve/decline controls render only for hc.applications.review, and the database enforces it again.
export default async function ApplicationsPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/applications");
  const caps = hcCapabilities(context);
  const { data, error } = await supabase.rpc("hc_admin_list_applications", { p_status: null, p_limit: 100 });
  const rows = error ? null : parseApplications(data);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl text-forest">Applications</h1>
      {rows === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the database package is applied.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-charcoal/70">No applications yet.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((a) => (
            <li key={a.id} className="rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg text-forest">{a.fullName}</p>
                <p className="text-charcoal/70">{a.status.replace("_", " ")}</p>
              </div>
              <p className="text-charcoal/70">{a.email}</p>
              {a.possibleDuplicate ? <p className="mt-1 font-medium text-error">Possible duplicate: shares a handle with another application. Check before approving.</p> : null}
              <p className="mt-2">{a.audienceSummary}</p>
              <p className="mt-1 text-charcoal/70">Niches: {a.niches.join(", ").replace(/_/g, " ") || "none"}</p>
              <p className="text-charcoal/70">Platforms: {a.platforms.map((p) => `${p.platform} ${p.handle ?? p.url ?? ""}`).join("; ") || "none"}</p>
              {caps.canReviewApplications && (a.status === "received" || a.status === "in_review") ? (
                <ActionForm action={reviewApplication} submitLabel="" className="mt-3 flex flex-wrap items-end gap-2" successText="Decision saved. The applicant has not been emailed by this action.">
                  <input type="hidden" name="id" value={a.id} />
                  <label className="text-xs">Tier (optional; blank = basic member)<input name="tier" maxLength={32} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                  <label className="text-xs">Referral code (optional)<input name="code" maxLength={32} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                  <label className="text-xs">Note<input name="note" maxLength={1000} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                  <SubmitButton name="decision" value="approved" label="Approve" className="rounded bg-forest px-3 py-1 text-parchment" />
                  <SubmitButton name="decision" value="declined" label="Decline" className="rounded border border-forest/30 px-3 py-1 text-forest" />
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-charcoal/70">Approving with no tier makes a basic member: creator portal and referral link only, no paid terms, and any commission is held until you decide. A tier you type must already be defined. Approval sends no email.</p>
    </div>
  );
}
