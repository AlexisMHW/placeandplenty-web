"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/host-actions";
import {
  checkSmartClosetWeb,
  resolveSmartClosetWeb,
  type SmartClosetMatch,
} from "@/lib/closet-smart-actions";

interface PersonOption {
  id: string;
  label: string;
}

export default function SmartShoppingAddForm({
  gatheringId,
  guests,
  coHosts,
  addItem,
}: {
  gatheringId: string;
  guests: PersonOption[];
  coHosts: PersonOption[];
  addItem: (formData: FormData) => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<SmartClosetMatch | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    category: "",
    quantity: "1",
    unit: "",
    estimatedCost: "",
  });
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [rentOpen, setRentOpen] = useState(false);
  const [provider, setProvider] = useState("");

  const quantity = Math.max(1, Math.round(Number(draft.quantity) || 1));

  function reset() {
    setDraft({ name: "", category: "", quantity: "1", unit: "", estimatedCost: "" });
    setMatch(null);
    setBorrowOpen(false);
    setRentOpen(false);
    setProvider("");
    setError(null);
    setOpen(false);
  }

  function savePlain() {
    const formData = new FormData();
    formData.set("name", draft.name);
    formData.set("category", draft.category);
    formData.set("quantity", String(quantity));
    formData.set("unit", draft.unit);
    formData.set("estimated_cost", draft.estimatedCost);
    start(async () => {
      const result = await addItem(formData);
      if (result.ok) reset();
      else setError(result.message);
    });
  }

  function submit() {
    if (!draft.name.trim()) {
      setError("Give the item a name.");
      return;
    }
    setError(null);
    start(async () => {
      const result = await checkSmartClosetWeb(
        gatheringId,
        draft.name.trim(),
        quantity,
        draft.category.trim() || null
      );
      if (!result.ok) {
        // Matching is an enhancement, not a gate. If the check itself is
        // temporarily unavailable, preserve the host's task by adding the
        // item normally rather than making Shopping unusable.
        const formData = new FormData();
        formData.set("name", draft.name);
        formData.set("category", draft.category);
        formData.set("quantity", String(quantity));
        formData.set("unit", draft.unit);
        formData.set("estimated_cost", draft.estimatedCost);
        const saved = await addItem(formData);
        if (saved.ok) reset();
        else setError(saved.message);
        return;
      }
      if (!result.match) {
        const formData = new FormData();
        formData.set("name", draft.name);
        formData.set("category", draft.category);
        formData.set("quantity", String(quantity));
        formData.set("unit", draft.unit);
        formData.set("estimated_cost", draft.estimatedCost);
        const saved = await addItem(formData);
        if (saved.ok) reset();
        else setError(saved.message);
        return;
      }
      setMatch(result.match);
    });
  }

  function resolve(
    action: "not_now" | "yes" | "borrow" | "rent",
    extra: { guestId?: string; memberId?: string; provider?: string } = {}
  ) {
    if (!match?.closetItemId) return;
    setError(null);
    start(async () => {
      const result = await resolveSmartClosetWeb({
        gatheringId,
        needName: draft.name.trim(),
        needQuantity: quantity,
        closetItemId: match.closetItemId as string,
        action,
        category: draft.category.trim() || null,
        guestId: extra.guestId ?? null,
        memberId: extra.memberId ?? null,
        provider: extra.provider ?? null,
      });
      if (result.ok) reset();
      else setError(result.message);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-7 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite shadow-soft transition hover:bg-forest/90"
      >
        Add to the list
      </button>
    );
  }

  if (match) {
    const fullyCovered = Boolean(match.fullyCovered);
    return (
      <section className="mt-7 max-w-3xl rounded-card border border-sage/35 bg-sage/15 p-5">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
          From your Hosting Closet
        </p>
        <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
        <p className="mt-3 font-display text-lg leading-snug text-forest">
          {fullyCovered
            ? `You have ${match.quantityOwned ?? 0} ${(match.name ?? draft.name).toLowerCase()} in your Hosting Closet. You’re covered.`
            : `You have ${match.quantityOwned ?? 0} ${(match.name ?? draft.name).toLowerCase()} in your Hosting Closet. Add ${match.quantityGap ?? 0} to your Shopping List?`}
        </p>

        {error && <p role="alert" className="mt-3 font-body text-sm text-error">{error}</p>}

        {fullyCovered ? (
          <button type="button" disabled={pending} onClick={() => resolve("yes")} className="mt-4 rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">
            {pending ? "Saving…" : "Use these"}
          </button>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" disabled={pending} onClick={() => resolve("yes")} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Yes</button>
              <button type="button" disabled={pending} onClick={() => resolve("not_now")} className="rounded-full border border-sage/40 px-5 py-2.5 font-body text-sm font-semibold text-forest disabled:opacity-50">Not now</button>
              <button type="button" disabled={pending} onClick={() => { setRentOpen(false); setBorrowOpen((value) => !value); }} className="px-3 py-2.5 font-body text-sm font-semibold text-forest/75">I’ll borrow them</button>
              <button type="button" disabled={pending} onClick={() => { setBorrowOpen(false); setRentOpen((value) => !value); }} className="px-3 py-2.5 font-body text-sm font-semibold text-forest/75">I’ll rent them</button>
            </div>

            {borrowOpen && (
              <div className="mt-4 rounded-xl border border-sage/25 bg-offwhite p-4">
                <p className="font-body text-sm font-semibold text-forest">Who are you borrowing from?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {guests.map((person) => (
                    <button key={`g:${person.id}`} type="button" disabled={pending} onClick={() => resolve("borrow", { guestId: person.id })} className="rounded-full border border-sage/35 px-3 py-2 font-body text-sm text-forest disabled:opacity-50">{person.label}</button>
                  ))}
                  {coHosts.map((person) => (
                    <button key={`m:${person.id}`} type="button" disabled={pending} onClick={() => resolve("borrow", { memberId: person.id })} className="rounded-full border border-sage/35 px-3 py-2 font-body text-sm text-forest disabled:opacity-50">{person.label}</button>
                  ))}
                  {guests.length === 0 && coHosts.length === 0 && <p className="font-body text-sm text-forest/60">Add a guest or co-host first so Place &amp; Plenty knows who has it.</p>}
                </div>
              </div>
            )}

            {rentOpen && (
              <div className="mt-4 rounded-xl border border-sage/25 bg-offwhite p-4">
                <label className="block font-body text-sm font-semibold text-forest">
                  Who are you renting from?
                  <input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Rental company or shop" className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body font-normal text-forest" />
                </label>
                <button type="button" disabled={pending || !provider.trim()} onClick={() => resolve("rent", { provider })} className="mt-3 rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Save</button>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  return (
    <section className="mt-7 max-w-3xl rounded-card border border-sage/30 bg-cream p-5 shadow-soft">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">Add to the list</p>
      <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Item" value={draft.name} onChange={(value) => setDraft((row) => ({ ...row, name: value }))} placeholder="Ice" />
        <Field label="Aisle or category" value={draft.category} onChange={(value) => setDraft((row) => ({ ...row, category: value }))} placeholder="Drinks" />
        <Field label="How many" value={draft.quantity} onChange={(value) => setDraft((row) => ({ ...row, quantity: value }))} type="number" />
        <Field label="Unit" value={draft.unit} onChange={(value) => setDraft((row) => ({ ...row, unit: value }))} placeholder="bags" />
        <Field label="Rough cost" value={draft.estimatedCost} onChange={(value) => setDraft((row) => ({ ...row, estimatedCost: value }))} type="number" placeholder="12.00" />
      </div>
      {error && <p role="alert" className="mt-3 font-body text-sm text-error">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" disabled={pending} onClick={submit} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">{pending ? "Checking…" : "Add item"}</button>
        <button type="button" disabled={pending} onClick={reset} className="rounded-full px-4 py-2.5 font-body text-sm text-forest/65 disabled:opacity-50">Cancel</button>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-sm font-semibold text-forest">{label}</span>
      <input type={type} min={type === "number" ? 0 : undefined} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" />
    </label>
  );
}
