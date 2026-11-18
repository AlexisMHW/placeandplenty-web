import { requireStaff } from "@/lib/admin/server";
import { estimatePlanCosts, formatMicroUsd, formatRate, parseDaysParam, parseSmsReport } from "@/lib/admin/sms";

// SMS REPORTING (read-only). Counts, rates and cost estimates from cc_sms_report. No phone numbers (masked last four on failures),
// no message text. This page has no switch: sending stays off until the founder approves activation outside this page.
const Counts = ({ title, data }: { title: string; data: Record<string, number> }) => (
  <div><p className="font-medium">{title}</p>
    {Object.keys(data).length === 0 ? <p className="text-charcoal/70">none</p> :
      <ul className="list-disc pl-5">{Object.entries(data).map(([k, n]) => <li key={k}>{k.replace(/[._]/g, " ")}: <span className="tabular-nums">{n}</span></li>)}</ul>}</div>
);
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-forest/20 bg-cream p-3"><p className="text-xs text-charcoal/70">{label}</p><p className="text-lg tabular-nums text-forest">{value}</p></div>
);

export default async function SmsReportPage({ searchParams }: { searchParams: { days?: string | string[] } }) {
  const days = parseDaysParam(searchParams.days);
  const { supabase } = await requireStaff("ops.read", "/command-center/sms");
  const { data, error } = await supabase.rpc("cc_sms_report", { p_days: days });
  const r = error ? null : parseSmsReport(data);
  const costs = r ? estimatePlanCosts(r) : [];
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-forest">SMS reporting</h1>
      <nav aria-label="Time window" className="flex gap-3 text-sm">
        {[7, 30, 90].map((d) => <a key={d} href={`/command-center/sms?days=${d}`} aria-current={d === days ? "page" : undefined} className={d === days ? "font-semibold underline" : "underline"}>{d} days</a>)}
      </nav>
      {!r ? <p role="status" className="rounded-lg border border-forest/20 bg-cream p-4 text-sm">Not available right now. SMS reporting needs the SMS database steps, which are not applied in this environment.</p> : (
        <>
          <p role="status" className="rounded-lg border border-forest/20 bg-cream p-3 text-sm">
            {r.killSwitch === true || r.smsEnabled === false ? "Sending is OFF." : r.smsEnabled === true && r.killSwitch === false ? "Sending is ON." : "Sending state is not available."} This page cannot change it.
          </p>
          <section aria-labelledby="usage" className="space-y-3 text-sm"><h2 id="usage" className="font-display text-xl text-forest">Usage (last {r.windowDays} days)</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Messages" value={String(r.messages)} /><Stat label="Segments used (net of refunds)" value={String(r.segmentsNet)} />
              <Stat label="Delivery rate" value={formatRate(r.deliveryRate)} /><Stat label="Estimated cost" value={formatMicroUsd(r.estCostMicroUsd, 2)} />
            </div>
            <Counts title="Messages by host-facing status" data={r.byStatus} />
            <Counts title="Not sent, by reason" data={r.blockedByReason} />
            <Counts title="Failures by carrier or provider code" data={r.failuresByError} />
          </section>
          <section aria-labelledby="optouts" className="space-y-3 text-sm"><h2 id="optouts" className="font-display text-xl text-forest">Opt-outs and suppression</h2>
            <p>Opt-out events in window: <span className="tabular-nums">{r.optOutEvents}</span>. Numbers suppressed now: <span className="tabular-nums">{r.suppressedTotal}</span>.</p>
            <Counts title="Suppressed by reason" data={r.suppressedByReason} />
          </section>
          <section aria-labelledby="plans" className="space-y-3 text-sm"><h2 id="plans" className="font-display text-xl text-forest">Consumption by plan</h2>
            {costs.length === 0 ? <p className="text-charcoal/70">none</p> : (
              <table className="w-full text-left"><caption className="sr-only">Segments and estimated cost by plan</caption>
                <thead><tr><th scope="col">Plan</th><th scope="col">Segments</th><th scope="col">Estimated cost</th></tr></thead>
                <tbody>{costs.map((c) => <tr key={c.planKey}><th scope="row" className="font-normal">{c.planKey.replace(/_/g, " ")}</th><td className="tabular-nums">{c.segments}</td><td className="tabular-nums">{c.costMicroUsd === null ? "no price row" : formatMicroUsd(c.costMicroUsd, 2)}</td></tr>)}</tbody></table>)}
          </section>
          <section aria-labelledby="prices" className="space-y-3 text-sm"><h2 id="prices" className="font-display text-xl text-forest">Per-segment price rows in use</h2>
            {r.prices.length === 0 ? <p role="status" className="text-charcoal/70">No price row: texting is blocked until one is added.</p> : (
              <ul className="list-disc pl-5">{r.prices.map((p, i) => <li key={i}>{p.provider} {p.numberType.replace(/_/g, " ")} {p.direction}: {formatMicroUsd(p.unitMicroUsd)} + carrier fee {formatMicroUsd(p.carrierFeeMicroUsd)}{p.note ? ` (${p.note})` : ""}</li>)}</ul>)}
          </section>
          <section aria-labelledby="fails" className="space-y-3 text-sm"><h2 id="fails" className="font-display text-xl text-forest">Recent failures</h2>
            {r.recentFailures.length === 0 ? <p className="text-charcoal/70">none</p> : (
              <ul className="list-disc pl-5">{r.recentFailures.map((f) => <li key={f.messageId}>{f.kind}, code {f.errorCode ?? "unknown"}, number {f.phoneMasked}{f.at ? `, ${f.at.slice(0, 16).replace("T", " ")}` : ""}</li>)}</ul>)}
          </section>
        </>)}
    </div>
  );
}
