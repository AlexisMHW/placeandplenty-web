"use client";
import { useFormState, useFormStatus } from "react-dom";
import { lookupCustomer, type LookupState } from "./actions";
import { entitlementStatus } from "@/lib/admin/cc";

const initial: LookupState = { status: "idle" };
function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded bg-forest px-3 py-1 text-parchment disabled:opacity-60">{pending ? "Looking up…" : "Look up"}</button>;
}
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "n/a");

export function LookupForm() {
  const [state, action] = useFormState(lookupCustomer, initial);
  return (
    <section aria-labelledby="lookup" className="space-y-3">
      <h2 id="lookup" className="font-display text-xl text-forest">Customer lookup</h2>
      <p className="text-sm text-charcoal/70">Enter an exact email address or account id. This is read-only and every lookup is recorded in the audit log. It cannot change anything.</p>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Email or account id<input name="q" type="text" autoComplete="off" required minLength={3} maxLength={254} className="ml-2 w-72 rounded border border-forest/30 px-2 py-1" /></label>
        <Submit />
      </form>
      {state.status === "error" ? <p role="alert" className="text-sm text-error">{state.code === "invalid_query" ? "Enter a full email address or an account id." : "The lookup did not work. Try again."}</p> : null}
      {state.status === "done" && !state.result.found ? <p role="status" className="text-sm">No account found.</p> : null}
      {state.status === "done" && state.result.found ? (
        <div className="space-y-3 rounded-lg border border-forest/15 bg-parchment p-4 text-sm">
          <p><span className="font-medium">{state.result.emailMasked}</span> · account created {day(state.result.createdAt)} · email {state.result.emailConfirmed ? "confirmed" : "not confirmed"}</p>
          {state.result.entitlements.length === 0 ? <p>No purchases or grants on this account.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-cream"><tr>{["Product", "Source", "Status", "Purchased", "Ends"].map((h) => <th key={h} scope="col" className="px-2 py-1">{h}</th>)}</tr></thead>
              <tbody>{state.result.entitlements.map((e) => (
                <tr key={e.id} className="border-t border-forest/10"><td className="px-2 py-1">{e.product.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1">{e.provider ?? "n/a"}{e.environment && e.environment !== "production" ? ` (${e.environment})` : ""}</td>
                  <td className="px-2 py-1">{entitlementStatus(e, new Date())}</td><td className="px-2 py-1">{day(e.purchasedAt)}</td><td className="px-2 py-1">{day(e.expiresAt)}</td></tr>))}</tbody></table></div>)}
          {state.result.events && state.result.events.length ? (<div><p className="font-medium">Recent purchase events</p><ul className="list-disc pl-5">{state.result.events.slice(0, 10).map((e, i) => <li key={i}>{day(e.createdAt)}: {e.type.replace(/_/g, " ")}{e.reason ? ` (${e.reason})` : ""}</li>)}</ul></div>) : null}
          <p className="text-xs text-charcoal/70">Refunds, access changes and grants are not done from this page.</p>
        </div>
      ) : null}
    </section>
  );
}
