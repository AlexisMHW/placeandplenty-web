import { requireStaff } from "@/lib/admin/server";
import { dollars, hcCapabilities, parseCommissionReport, parsePayoutEligibility } from "@/lib/admin/hc";
import { parsePayouts } from "@/lib/admin/cc";
import { BUCKET_LABEL, LEDGER_BUCKETS, eventLabel, parseHistory, parseLedger, payoutStatusLabel } from "@/lib/admin/payout-ledger";
import { ActionForm } from "../../_components/action-form";
import { BLOCKER_TEXT, parseHolds } from "@/lib/hc/partial-refund";
import { addTermsVersion, paidReferralsSwitch, payoutAction, resolvePartialRefundHold, settleClawback } from "./actions";

// MANUAL PAYOUTS (founder decisions D3 and A). The page needs hc.payout: the owner and authorized financial staff read the history and ledger; a manager with only hc.read gets a 404 and no data.
// Every form and button renders ONLY for the OWNER (caps.canSeePayoutActions) and is re-checked on the server and in the database. Financial staff who are not the owner see a read-only view.
// The five money buckets (pending, validated, in a draft, approved, paid) are shown separately and never summed. APPROVED IS NOT PAID.
// Nothing here or in the database moves money: "Record external payment" records a payment the owner already made outside this system.
export default async function PayoutsPage() {
  const { context, supabase } = await requireStaff("hc.payout", "/command-center/hosting-collective/payouts");
  const caps = hcCapabilities(context);
  const [elig, report, payoutsRes, termsRes, ledgerRes, histRes, holdsRes] = await Promise.all([
    supabase.rpc("hc_admin_payout_eligibility"),
    supabase.rpc("hc_admin_commission_report"),
    supabase.rpc("hc_admin_list_payouts", { p_limit: 50 }),
    supabase.rpc("hc_admin_current_terms"),
    supabase.rpc("hc_admin_payout_ledger"),
    supabase.rpc("hc_admin_payout_history", { p_partner_id: null, p_limit: 50 }),
    supabase.rpc("hc_admin_list_partial_refund_holds", { p_limit: 100 }),
  ]);
  const payouts = payoutsRes.error ? null : parsePayouts(payoutsRes.data);
  const terms = termsRes.error ? null : (termsRes.data as { version?: number; validation_days?: number; min_payout_cents?: number } | null);
  const e = elig.error ? null : parsePayoutEligibility(elig.data);
  const r = report.error ? null : parseCommissionReport(report.data);
  const ledger = ledgerRes.error ? null : parseLedger(ledgerRes.data);
  const history = histRes.error ? null : parseHistory(histRes.data);
  const holds = holdsRes.error ? null : parseHolds(holdsRes.data);
  const today = new Date().toISOString().slice(0, 10);
  const names = new Map((ledger?.partners ?? []).map((p) => [p.partnerId, p.displayName] as const));
  const input = "ml-1 rounded border border-forest/30 px-2 py-1";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">Manual payouts</h1>
      <p className="text-sm text-charcoal/80">Payouts are manual. This page never sends money. You draft, approve, send the payment yourself outside this system, then record it here with its reference. Approved does not mean paid. Payments happen outside the app; the app never moves money.</p>
      {!caps.canSeePayoutActions ? <p role="note" className="rounded-lg border border-forest/20 bg-cream p-3 text-sm">Read only. You can view the payout history and ledger. Only the owner can draft, approve, void, reverse or record a payment, or settle a clawback.</p> : null}
      {!e || !r ? (
        <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available until the referral and Hosting Collective database packages are applied.</p>
      ) : (
        <>
          <section aria-labelledby="sw" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">
            <h2 id="sw" className="font-display text-lg text-forest">Paid referrals switch: {e.paidReferralsEnabled ? "ON" : "OFF"}</h2>
            <p className="mt-1">{e.paidReferralsEnabled ? "Payout drafts and approvals are possible." : "Off. No commission is paid out, no payout can be drafted or approved, and members are not shown earnings."}
              {!e.live ? ` Not live: ${!e.programEnabled ? "the referral program is switched off" : !e.rateConfigured ? "no commission terms are configured" : "paid referrals are off"}. Figures below are not earnings.` : ""}</p>
            {caps.canSeePayoutActions ? (
              <ActionForm action={paidReferralsSwitch} submitLabel={e.paidReferralsEnabled ? "Switch paid referrals OFF" : "Switch paid referrals ON"} className="mt-2 flex flex-wrap items-end gap-2 text-xs" successText={e.paidReferralsEnabled ? "Paid referrals are now OFF." : "Paid referrals are now ON."}>
                <input type="hidden" name="mode" value={e.paidReferralsEnabled ? "deactivate" : "activate"} />
                {!e.paidReferralsEnabled ? <label>Type ACTIVATE PAID REFERRALS to confirm<input name="phrase" autoComplete="off" className={`${input} w-56`} /></label> : null}
                <label>Reason<input name="reason" required minLength={3} maxLength={200} className={input} /></label>
              </ActionForm>) : <p className="mt-1 text-xs text-charcoal/70">Only the owner can change this switch.</p>}
          </section>
          <section aria-labelledby="ledger">
            <h2 id="ledger" className="mb-2 font-display text-xl text-forest">Where the money stands (kept separate, never added together)</h2>
            {ledger === null ? <p role="status" className="text-sm text-charcoal/70">Ledger not available.</p> : (
              <>
                <dl className="grid gap-2 sm:grid-cols-5">{LEDGER_BUCKETS.map((b) => (
                  <div key={b} className="rounded-lg border border-forest/15 bg-parchment p-3"><dt className="text-xs text-charcoal/70">{BUCKET_LABEL[b]}</dt><dd className="tabular-nums text-lg text-forest">{dollars(ledger.totals[b])}</dd></div>))}</dl>
                <p className="mt-2 text-xs text-charcoal/70">
                  {ledger.totals.heldCount ? `${ledger.totals.heldCount} commission(s) on hold. ` : ""}{ledger.totals.unratedCount ? `${ledger.totals.unratedCount} without a configured amount (not counted). ` : ""}
                  {ledger.totals.outstandingClawbackCents ? `Outstanding clawbacks: ${dollars(ledger.totals.outstandingClawbackCents)} (recorded only; no automatic netting).` : ""}
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-forest/15"><table className="w-full text-left text-sm">
                  <thead className="bg-cream"><tr>{["Member", "Pending", "Validated", "In draft", "Approved", "Paid"].map((h) => <th key={h} scope="col" className="px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody>{ledger.partners.length === 0 ? <tr><td colSpan={6} className="px-3 py-3 text-charcoal/70">No members yet.</td></tr> : ledger.partners.map((p) => (
                    <tr key={p.partnerId} className="border-t border-forest/10"><td className="px-3 py-2">{p.displayName}</td>{LEDGER_BUCKETS.map((b) => <td key={b} className="px-3 py-2 tabular-nums">{dollars(p[b])}</td>)}</tr>))}</tbody></table></div>
              </>)}
          </section>
          <section aria-labelledby="elig">
            <h2 id="elig" className="mb-1 font-display text-xl text-forest">Payout eligibility</h2>
            <p className="mb-2 text-sm text-charcoal/70">Eligible = validated commissions minus outstanding clawbacks reach the minimum ({dollars(e.minPayoutCents)}), program live. Nothing is paid automatically.</p>
            {e.partners.length === 0 ? <p className="text-sm text-charcoal/70">No members yet.</p> : (
              <ul className="space-y-2 text-sm">{e.partners.map((p) => (
                <li key={p.partnerId} className="flex flex-wrap items-center gap-2">{p.displayName}: validated {dollars(p.validatedCents)}, clawback {dollars(p.outstandingClawbackCents)} — {p.eligible ? "eligible for manual review" : "not eligible"}
                  {caps.canSeePayoutActions && p.eligible ? (
                    <ActionForm action={payoutAction} submitLabel="Create payout draft" submitClassName="rounded border border-forest/30 px-2 py-0.5 text-forest" successText="Draft created. Nothing has been paid.">
                      <input type="hidden" name="kind" value="draft" /><input type="hidden" name="partner_id" value={p.partnerId} /></ActionForm>) : null}</li>))}
              </ul>)}
          </section>
          <section aria-labelledby="po">
            <h2 id="po" className="mb-2 font-display text-xl text-forest">Payouts</h2>
            {payouts === null ? <p role="status" className="text-sm text-charcoal/70">Not available.</p> : payouts.length === 0 ? <p className="text-sm text-charcoal/70">No payouts yet.</p> : (
              <ul className="space-y-3 text-sm">{payouts.map((p) => (
                <li key={p.id} className="rounded-lg border border-forest/15 bg-parchment p-3">
                  <p>{p.displayName}: {dollars(p.totalCents)} — <span className="font-medium">{payoutStatusLabel(p.status)}</span>
                    {p.paidOn ? `, sent on ${p.paidOn}` : p.paidAt ? ` on ${p.paidAt.slice(0, 10)}` : ""}{p.externalRef ? ` (reference ${p.externalRef}${p.method ? `, ${p.method}` : ""})` : ""}{p.voidReason ? ` (voided: ${p.voidReason})` : ""}{p.reversalReason ? ` (reversed: ${p.reversalReason})` : ""}</p>
                  {caps.canSeePayoutActions && p.status === "draft" ? (
                    <ActionForm action={payoutAction} submitLabel="Approve payout" className="mt-2" successText="Approved. It is NOT paid until you record the external payment.">
                      <input type="hidden" name="kind" value="approve" /><input type="hidden" name="payout_id" value={p.id} /></ActionForm>) : null}
                  {caps.canSeePayoutActions && p.status === "approved" ? (
                    <ActionForm action={payoutAction} submitLabel="Record external payment" className="mt-2 flex flex-wrap items-end gap-2" successText="Recorded as paid. No money was moved by this system.">
                      <input type="hidden" name="kind" value="paid" /><input type="hidden" name="payout_id" value={p.id} />
                      <label className="text-xs">Reference of the payment you made<input name="external_ref" required minLength={4} maxLength={120} className={input} /></label>
                      <label className="text-xs">How you paid<input name="method" required minLength={2} maxLength={60} placeholder="bank transfer" className={input} /></label>
                      <label className="text-xs">Date you sent it<input name="paid_on" type="date" required max={today} className={input} /></label>
                      <label className="text-xs"><input type="checkbox" name="confirm" value="yes" required /> I confirm I already sent this payment outside this system. This only records it.</label></ActionForm>) : null}
                  {caps.canSeePayoutActions && p.status === "paid" ? (
                    <ActionForm action={payoutAction} submitLabel="Reverse this payment" submitClassName="rounded border border-error/50 px-3 py-1 text-error" className="mt-2 flex flex-wrap items-end gap-2" successText="Reversed. The commissions are back to validated.">
                      <input type="hidden" name="kind" value="reverse" /><input type="hidden" name="payout_id" value={p.id} />
                      <label className="text-xs">Why (money returned, payment failed…)<input name="reason" required minLength={3} maxLength={200} className={input} /></label>
                      <label className="text-xs"><input type="checkbox" name="confirm" value="yes" required /> I confirm the external payment did not complete or was returned.</label></ActionForm>) : null}
                  {caps.canSeePayoutActions && (p.status === "draft" || p.status === "approved") ? (
                    <ActionForm action={payoutAction} submitLabel="Void" submitClassName="rounded border border-forest/30 px-3 py-1 text-forest" className="mt-2 flex flex-wrap items-end gap-2" successText="Voided. The commissions can be drafted again.">
                      <input type="hidden" name="kind" value="void" /><input type="hidden" name="payout_id" value={p.id} />
                      <label className="text-xs">Reason<input name="reason" required minLength={3} maxLength={200} className={input} /></label></ActionForm>) : null}
                </li>))}</ul>)}
          </section>
          <section aria-labelledby="pr">
            <h2 id="pr" className="mb-1 font-display text-xl text-forest">Partial refund reviews</h2>
            <p className="mb-2 text-sm text-charcoal/70">A commission is held for review when part of the purchase was refunded. It is never paid while it is held. Releasing it puts it back on the normal path (it becomes payable only after its original validation period, through the normal draft and approval). Reversing it is final: it is never paid. Neither choice moves money. Only the owner can decide.</p>
            {holds === null ? <p role="status" className="text-sm text-charcoal/70">Not available until the follow-up database package is applied.</p> : holds.holds.length === 0 ? <p className="text-sm text-charcoal/70">No commissions are waiting for a partial refund review.</p> : (
              <ul className="space-y-3 text-sm">{holds.holds.map((h) => (
                <li key={h.commissionId} className="rounded-lg border border-forest/15 bg-parchment p-3">
                  <p>{h.displayName}: {h.commissionCents !== null ? dollars(h.commissionCents) : "amount not set"}{h.product ? ` (${h.product === "plus_annual" ? "Plus" : h.product === "gathering_pass" ? "Gathering Pass" : h.product})` : ""}{h.refundedCents !== null ? ` — refunded so far ${dollars(h.refundedCents)}` : ""}{h.validateAfter ? ` — original validation date ${h.validateAfter.slice(0, 10)}` : ""}</p>
                  {h.releaseBlocker ? <p className="mt-1 text-xs text-error">{BLOCKER_TEXT[h.releaseBlocker] ?? "It cannot be released right now."}</p> : null}
                  {caps.canSeePayoutActions ? (
                    <ActionForm action={resolvePartialRefundHold} submitLabel="Release back to the normal path" submitClassName="rounded border border-forest/30 px-3 py-1 text-forest" className="mt-2 flex flex-wrap items-end gap-2" successText="Released. It follows the normal validation period; nothing was paid.">
                      <input type="hidden" name="resolution" value="release" /><input type="hidden" name="commission_id" value={h.commissionId} />
                      <label className="text-xs">Note (why it is fine)<input name="note" required minLength={3} maxLength={300} className={input} /></label>
                      <label className="text-xs"><input type="checkbox" name="confirm" value="yes" required /> I reviewed the refund and want this commission back on the normal path.</label></ActionForm>) : null}
                  {caps.canSeePayoutActions ? (
                    <ActionForm action={resolvePartialRefundHold} submitLabel="Reverse (final, never paid)" submitClassName="rounded border border-error/50 px-3 py-1 text-error" className="mt-2 flex flex-wrap items-end gap-2" successText="Reversed. This commission will never be paid.">
                      <input type="hidden" name="resolution" value="reverse" /><input type="hidden" name="commission_id" value={h.commissionId} />
                      <label className="text-xs">Note (why)<input name="note" required minLength={3} maxLength={300} className={input} /></label>
                      <label className="text-xs"><input type="checkbox" name="confirm" value="yes" required /> I understand a reversal is final.</label></ActionForm>) : null}
                </li>))}</ul>)}
            {holds && holds.recent.length ? (
              <details className="mt-2 text-xs text-charcoal/70"><summary>Recent decisions</summary>
                <ul className="mt-1 list-disc pl-5">{holds.recent.map((r, i) => <li key={i}>{r.resolution === "release" ? "Released" : "Reversed"}{r.resolvedAt ? ` — ${r.resolvedAt.slice(0, 16).replace("T", " ")} UTC` : ""}: {r.note}</li>)}</ul></details>) : null}
          </section>
          <section aria-labelledby="hist">
            <h2 id="hist" className="mb-2 font-display text-xl text-forest">Payout history and audit trail</h2>
            {history === null ? <p role="status" className="text-sm text-charcoal/70">History not available.</p> : history.length === 0 ? <p className="text-sm text-charcoal/70">Nothing to show yet.</p> : (
              <ul className="space-y-2 text-sm">{history.map((h) => (
                <li key={h.id} className="rounded-lg border border-forest/15 p-3">
                  <p>{(h.partnerId && names.get(h.partnerId)) || "Member"}: {dollars(h.totalCents)} — {payoutStatusLabel(h.status)}{h.commissionCount !== null ? ` · ${h.commissionCount} commission(s) attached` : ""}{h.paidOn ? ` · sent ${h.paidOn}` : ""}</p>
                  {h.events.length ? <ol className="mt-1 list-decimal pl-5 text-xs text-charcoal/70">{h.events.map((a, i) => <li key={i}>{eventLabel(a.event)}{a.at ? ` — ${a.at.slice(0, 16).replace("T", " ")} UTC` : ""}</li>)}</ol> : null}
                </li>))}</ul>)}
          </section>
          {caps.canSeePayoutActions ? (
            <section aria-labelledby="claw">
              <h2 id="claw" className="mb-1 font-display text-xl text-forest">Settle a clawback</h2>
              <p className="mb-2 text-sm text-charcoal/70">A clawback is the amount of a commission that was already paid and then reversed (refund or dispute). Settlement is recorded here only. No money moves in this app and nothing is netted automatically: you recover or waive the amount outside the app, then record it here.</p>
              <ActionForm action={settleClawback} submitLabel="Record clawback settlement" className="flex flex-wrap items-end gap-2 text-xs" successText="Settlement recorded. No money was moved by this system.">
                <label>Commission id<input name="commission_id" required pattern="[0-9a-fA-F-]{36}" className={`${input} w-80`} /></label>
                <label>Outcome<select name="resolution" defaultValue="" required className={input}><option value="" disabled>choose</option><option value="recovered_externally">Recovered outside the app</option><option value="waived">Waived</option></select></label>
                <label>Reference (needed if recovered)<input name="external_ref" maxLength={120} className={input} /></label>
                <label>Note<input name="note" required minLength={3} maxLength={300} className={input} /></label>
                <label><input type="checkbox" name="confirm" value="yes" required /> I confirm this settlement happened outside the app. This only records it.</label>
              </ActionForm>
            </section>) : null}
          {caps.canSeePayoutActions ? (
            <section aria-labelledby="terms">
              <h2 id="terms" className="mb-1 font-display text-xl text-forest">Commission terms</h2>
              <p className="mb-2 text-sm text-charcoal/70">{terms?.version ? `Version ${terms.version} is in force.` : "No terms in force."} A change creates a NEW version that takes effect in the future; old versions and earned commissions are never edited. Leave an amount blank to keep the current one. Amounts are in cents. Full version history is on the Tiers and terms page.</p>
              <ActionForm action={addTermsVersion} submitLabel="Add terms version" className="flex flex-wrap items-end gap-2 text-xs" successText="New terms version saved. It takes effect at the time you chose.">
                <label>Gathering Pass (cents)<input name="amount_gathering_pass" inputMode="numeric" className={`${input} w-20`} /></label>
                <label>Plus (cents)<input name="amount_plus_annual" inputMode="numeric" className={`${input} w-20`} /></label>
                <label>Validation days<input name="validation_days" required inputMode="numeric" defaultValue={terms?.validation_days ?? ""} className={`${input} w-16`} /></label>
                <label>Minimum payout (cents)<input name="min_payout_cents" required inputMode="numeric" defaultValue={terms?.min_payout_cents ?? ""} className={`${input} w-20`} /></label>
                <label>Effective from (UTC)<input name="effective_from" type="datetime-local" required className={input} /></label>
                <label><input type="checkbox" name="confirm" value="yes" required /> I have approved these terms.</label>
              </ActionForm>
            </section>) : null}
        </>
      )}
    </div>
  );
}
