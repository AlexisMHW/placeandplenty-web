import { requireStaff } from "@/lib/admin/server";
import { dollars, hcCapabilities, parseCommissionReport, parsePayoutEligibility } from "@/lib/admin/hc";
import { parsePayouts } from "@/lib/admin/cc";
import { ActionForm } from "@/components/hc/ActionForm";
import { payoutForm, termsForm } from "./payout-form-actions";

// REFERRALS, PENDING COMMISSIONS AND PAYOUT ELIGIBILITY. Read-only. Both database functions re-check hc.read.
// Figures are ledger values. When the program is disabled or no commission rate is configured, a banner says the numbers are not live.
// Payout buttons (draft, approve, mark paid, void) and the terms form render ONLY for the owner (hc.payout) and every one is checked again in the
// database. Nothing here moves money: "mark paid" records a transfer made elsewhere.
export default async function PayoutsPage() {
  const { context, supabase } = await requireStaff("hc.read", "/command-center/hosting-collective/payouts");
  const caps = hcCapabilities(context);
  const [elig, report, payoutsRes, termsRes] = await Promise.all([
    supabase.rpc("hc_admin_payout_eligibility"),
    supabase.rpc("hc_admin_commission_report"),
    supabase.rpc("hc_admin_list_payouts", { p_limit: 50 }),
    supabase.rpc("hc_admin_current_terms"),
  ]);
  const payouts = payoutsRes.error ? null : parsePayouts(payoutsRes.data);
  const terms = termsRes.error ? null : (termsRes.data as { version?: number; amounts?: Record<string, number>; validation_days?: number; min_payout_cents?: number } | null);
  const e = elig.error ? null : parsePayoutEligibility(elig.data);
  const r = report.error ? null : parseCommissionReport(report.data);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Referrals and payout eligibility</h1>
      {!e || !r ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the referral and Hosting Collective database packages are applied.</p>
      ) : (
        <>
          {!e.live ? (
            <p role="status" className="rounded-lg border border-error/40 bg-cream p-4 text-sm">
              Not live: {!e.programEnabled ? "the referral program is switched off" : "no commission rate has been configured"}. Any figures below are not earnings.
            </p>
          ) : null}
          <section aria-labelledby="ref">
            <h2 id="ref" className="mb-2 font-display text-xl text-forest">Referred sign-ups and commissions by state</h2>
            <div className="overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
              <thead className="bg-cream"><tr>{["Partner", "Status", "Referred sign-ups", "Pending", "Validated", "Held"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{r.partners.map((p) => (
                <tr key={p.partnerId} className="border-t border-forest/10">
                  <td className="px-3 py-2">{p.displayName}</td><td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 tabular-nums">{p.signups ?? "n/a"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.pending ? `${p.byState.pending.n} / ${dollars(p.byState.pending.cents)}` : "0"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.validated ? `${p.byState.validated.n} / ${dollars(p.byState.validated.cents)}` : "0"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.byState.held ? p.byState.held.n : "0"}</td>
                </tr>))}</tbody></table></div>
          </section>
          <section aria-labelledby="elig">
            <h2 id="elig" className="mb-1 font-display text-xl text-forest">Payout eligibility</h2>
            <p className="mb-2 text-sm text-charcoal/70">Eligible = validated commissions minus outstanding clawbacks reach the minimum ({dollars(e.minPayoutCents)}), program live. Nothing is paid automatically.</p>
            <ul className="space-y-2 text-sm">{e.partners.map((p) => (
              <li key={p.partnerId} className="flex flex-wrap items-center gap-2">{p.displayName}: validated {dollars(p.validatedCents)}, clawback {dollars(p.outstandingClawbackCents)} — {p.eligible ? "eligible for manual review" : "not eligible"}
                {caps.canSeePayoutActions && p.eligible ? (
                  <ActionForm action={payoutForm} buttons={[{ label: "Create payout draft", secondary: true }]}><input type="hidden" name="kind" value="draft" /><input type="hidden" name="partner_id" value={p.partnerId} /></ActionForm>) : null}</li>))}
            </ul>
          </section>
          <section aria-labelledby="po">
            <h2 id="po" className="mb-2 font-display text-xl text-forest">Payouts</h2>
            {payouts === null ? <p className="text-sm text-charcoal/70">Not available.</p> : payouts.length === 0 ? <p className="text-sm text-charcoal/70">No payouts yet.</p> : (
              <ul className="space-y-3 text-sm">{payouts.map((p) => (
                <li key={p.id} className="rounded-lg border border-forest/15 bg-parchment p-3">
                  <p>{p.displayName}: {dollars(p.totalCents)} — <span className="font-medium">{p.status}</span>{p.paidAt ? ` on ${p.paidAt.slice(0, 10)}` : ""}{p.externalRef ? ` (ref ${p.externalRef})` : ""}{p.voidReason ? ` (void: ${p.voidReason})` : ""}</p>
                  {caps.canSeePayoutActions && p.status === "draft" ? (
                    <ActionForm action={payoutForm} buttons={[{ label: "Approve payout" }]} className="mt-2"><input type="hidden" name="kind" value="approve" /><input type="hidden" name="payout_id" value={p.id} /></ActionForm>) : null}
                  {caps.canSeePayoutActions && p.status === "approved" ? (
                    <ActionForm action={payoutForm} buttons={[{ label: "Record as paid" }]} className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="kind" value="paid" /><input type="hidden" name="payout_id" value={p.id} />
                      <label className="text-xs">Reference of the transfer you made outside this system<input name="external_ref" required minLength={3} maxLength={120} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                      <label className="text-xs"><input type="checkbox" name="confirm" value="yes" required /> I already sent this payment. This only records it.</label></ActionForm>) : null}
                  {caps.canSeePayoutActions && (p.status === "draft" || p.status === "approved") ? (
                    <ActionForm action={payoutForm} buttons={[{ label: "Void", secondary: true }]} className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="kind" value="void" /><input type="hidden" name="payout_id" value={p.id} />
                      <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className="ml-1 rounded border border-forest/30 px-2 py-1" /></label></ActionForm>) : null}
                </li>))}</ul>)}
          </section>
          {caps.canSeePayoutActions ? (
            <section aria-labelledby="terms">
              <h2 id="terms" className="mb-1 font-display text-xl text-forest">Commission terms</h2>
              <p className="mb-2 text-sm text-charcoal/70">{terms?.version ? `Version ${terms.version} is in force.` : "No terms in force."} A change creates a NEW version that takes effect in the future; old versions and earned commissions are never edited. Leave an amount blank to keep the current one. Amounts are in cents.</p>
              <ActionForm action={termsForm} buttons={[{ label: "Add terms version" }]} className="flex flex-wrap items-end gap-2 text-xs">
                <label>Gathering Pass (cents)<input name="amount_gathering_pass" inputMode="numeric" className="ml-1 w-20 rounded border border-forest/30 px-2 py-1" /></label>
                <label>Plus (cents)<input name="amount_plus_annual" inputMode="numeric" className="ml-1 w-20 rounded border border-forest/30 px-2 py-1" /></label>
                <label>Validation days<input name="validation_days" required inputMode="numeric" defaultValue={terms?.validation_days ?? ""} className="ml-1 w-16 rounded border border-forest/30 px-2 py-1" /></label>
                <label>Minimum payout (cents)<input name="min_payout_cents" required inputMode="numeric" defaultValue={terms?.min_payout_cents ?? ""} className="ml-1 w-20 rounded border border-forest/30 px-2 py-1" /></label>
                <label>Effective from (UTC)<input name="effective_from" type="datetime-local" required className="ml-1 rounded border border-forest/30 px-2 py-1" /></label>
                <label><input type="checkbox" name="confirm" value="yes" required /> I have approved these terms.</label>
              </ActionForm>
            </section>) : null}
        </>
      )}
    </div>
  );
}
