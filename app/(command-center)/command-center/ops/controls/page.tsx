import { requireStaff } from "@/lib/admin/server";
import { canActOnPayouts } from "@/lib/admin/payout-access";
import { parseSwitches } from "@/lib/admin/controls";
import { ActionForm, SubmitButton } from "../../_components/action-form";
import { setSwitch } from "./actions";

// OPERATIONAL CONTROLS. hc.read to see the state; only the owner gets the forms. Each change needs a reason and is audited.
const label = (v: boolean | null, on: string, off: string) => (v === null ? "not available" : v ? on : off);
export default async function ControlsPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/ops/controls");
  const { data, error } = await supabase.rpc("hc_admin_get_program_switches");
  const s = error ? null : parseSwitches(data);
  const owner = canActOnPayouts(context);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Operational controls</h1>
      {s === null ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the controls database step is applied.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          <li className="rounded-lg border border-forest/15 bg-parchment p-4">
            <p className="font-display text-lg text-forest">Hosting Collective program: {label(s.programEnabled, "on", "off")}</p>
            <p className="text-charcoal/70">While off, nothing is recorded or validated for referrals.</p>
            {owner && s.programEnabled !== null ? (
              <ActionForm action={setSwitch} submitLabel="" className="mt-2 flex flex-wrap items-end gap-2" successText="Saved and recorded in the audit log.">
                <input type="hidden" name="kind" value="program" />
                <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                <SubmitButton name="state" value={s.programEnabled ? "off" : "on"} label={s.programEnabled ? "Switch off" : "Switch on"} />
              </ActionForm>) : null}
          </li>
          <li className="rounded-lg border border-forest/15 bg-parchment p-4">
            <p className="font-display text-lg text-forest">Creator applications: {label(s.applicationsOpen, "open", "closed")}</p>
            <p className="text-charcoal/70">Terms version shown to applicants: {s.termsVersion ?? "none set"}. Opening needs a terms version.</p>
            {owner && s.applicationsOpen !== null ? (
              <ActionForm action={setSwitch} submitLabel="" className="mt-2 flex flex-wrap items-end gap-2" successText="Saved and recorded in the audit log.">
                <input type="hidden" name="kind" value="applications" />
                <label className="text-xs">Terms version<input name="terms_version" maxLength={40} defaultValue={s.termsVersion ?? ""} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                <SubmitButton name="state" value={s.applicationsOpen ? "off" : "on"} label={s.applicationsOpen ? "Close applications" : "Open applications"} />
              </ActionForm>) : null}
          </li>
          <li className="rounded-lg border border-forest/15 bg-parchment p-4">
            <p className="font-display text-lg text-forest">Paid referrals: {label(s.paidReferralsEnabled, "on", "off")}</p>
            <p className="text-charcoal/70">Changed only on the Payouts page (owner, typed confirmation). Not changeable here.</p>
          </li>
        </ul>
      )}
      {!owner ? <p className="text-xs text-charcoal/70">Only the owner can change these.</p> : null}
    </div>
  );
}
