"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/host-actions";

const SIMPLE_STATUSES = [
  ["need", "Need"],
  ["have", "Have"],
  ["bought", "Bought"],
  ["not_needed", "Not needed"],
] as const;

export function ShoppingFulfillmentControl({
  status,
  itemName,
  provider,
  returnedAt,
  guests,
  coHosts,
  setStatus,
  assignBorrow,
  setProvider,
  setReturned,
}: {
  status: string;
  itemName: string;
  provider: string | null;
  returnedAt: string | null;
  guests: Array<{ id: string; label: string }>;
  coHosts: Array<{ id: string; label: string }>;
  setStatus: (status: string) => Promise<ActionResult>;
  assignBorrow: (type: "guest" | "co_host", id: string) => Promise<ActionResult>;
  setProvider: (status: "rent" | "hire", provider: string) => Promise<ActionResult>;
  setReturned: (returned: boolean) => Promise<ActionResult>;
}) {
  const [mode, setMode] = useState<"none" | "borrow" | "rent" | "hire">("none");
  const [current, setCurrent] = useState(status);
  const [assignee, setAssignee] = useState("");
  const [providerDraft, setProviderDraft] = useState(provider ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) onSuccess?.();
      else setError(result.message);
    });
  }

  return (
    <div className="min-w-[13rem]">
      <label className="block">
        <span className="sr-only">Status for {itemName}</span>
        <select
          value={current}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "borrow" || next === "rent" || next === "hire") {
              setMode(next);
              return;
            }
            const previous = current;
            setCurrent(next);
            setMode("none");
            run(() => setStatus(next), () => setCurrent(next));
            if (next === previous) setCurrent(previous);
          }}
          className="w-full rounded-md border border-sage/40 bg-offwhite px-3 py-2 font-body text-sm text-forest disabled:opacity-50"
        >
          {SIMPLE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="borrow">Borrow</option>
          <option value="rent">Rent</option>
          <option value="hire">Hire</option>
        </select>
      </label>

      {mode === "borrow" && (
        <div className="mt-2 rounded-xl border border-sage/25 bg-cream p-3">
          <p className="font-body text-xs font-semibold text-forest">Who are you borrowing it from?</p>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="mt-2 w-full rounded-md border border-sage/35 bg-white px-2.5 py-2 font-body text-sm text-forest">
            <option value="">Choose a person</option>
            {guests.map((guest) => <option key={`g:${guest.id}`} value={`guest:${guest.id}`}>{guest.label}</option>)}
            {coHosts.map((member) => <option key={`c:${member.id}`} value={`co_host:${member.id}`}>{member.label} · co-host</option>)}
          </select>
          <div className="mt-2 flex gap-3">
            <button type="button" disabled={!assignee || pending} onClick={() => {
              const [type, id] = assignee.split(":", 2) as ["guest" | "co_host", string];
              run(() => assignBorrow(type, id), () => { setCurrent("borrow"); setMode("none"); });
            }} className="font-body text-xs font-bold text-forest disabled:opacity-40">Use this person</button>
            <button type="button" onClick={() => setMode("none")} className="font-body text-xs text-forest/55">Cancel</button>
          </div>
        </div>
      )}

      {(mode === "rent" || mode === "hire") && (
        <div className="mt-2 rounded-xl border border-sage/25 bg-cream p-3">
          <p className="font-body text-xs font-semibold text-forest">{mode === "rent" ? "Who are you renting from?" : "Who are you hiring?"}</p>
          <input value={providerDraft} onChange={(e) => setProviderDraft(e.target.value)} placeholder="Provider or business" className="mt-2 w-full rounded-md border border-sage/35 bg-white px-2.5 py-2 font-body text-sm text-forest" />
          <div className="mt-2 flex gap-3">
            <button type="button" disabled={!providerDraft.trim() || pending} onClick={() => run(() => setProvider(mode, providerDraft), () => { setCurrent(mode); setMode("none"); })} className="font-body text-xs font-bold text-forest disabled:opacity-40">Save provider</button>
            <button type="button" onClick={() => setMode("none")} className="font-body text-xs text-forest/55">Cancel</button>
          </div>
        </div>
      )}

      {current === "borrow" && (
        <button type="button" disabled={pending} onClick={() => run(() => setReturned(!returnedAt))} className="mt-2 font-body text-xs font-semibold text-forest/65 underline underline-offset-4">
          {returnedAt ? "Mark as not returned" : "Mark returned"}
        </button>
      )}
      {(current === "rent" || current === "hire") && provider && (
        <p className="mt-1 font-body text-xs text-forest/55">{provider}</p>
      )}
      {error && <p role="alert" className="mt-1 font-body text-xs text-error">{error}</p>}
    </div>
  );
}
