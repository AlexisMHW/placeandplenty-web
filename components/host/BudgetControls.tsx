"use client";

import { useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/host-actions";

export function MoneyEditor({
  label,
  value,
  action,
  allowClear = true,
}: {
  label: string;
  value: number | null;
  action: (next: number | null) => Promise<ActionResult>;
  allowClear?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value == null ? "" : String(value));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = input.trim();
    const parsed = trimmed ? Number(trimmed) : null;
    if ((!allowClear && parsed === null) || (parsed !== null && (!Number.isFinite(parsed) || parsed < 0))) {
      setError("Enter a valid amount.");
      return;
    }
    start(async () => {
      const result = await action(parsed);
      if (result.ok) {
        setEditing(false);
        setError(null);
      } else setError(result.message);
    });
  }

  return (
    <div>
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">{label}</p>
      {editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} type="number" min="0" step="0.01" className="w-36 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
          <button type="button" disabled={pending} onClick={save} className="rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="px-2 font-body text-sm text-forest/60">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-1 font-display text-3xl text-forest">
          {value == null ? "Set amount" : `$${value.toFixed(2)}`}
        </button>
      )}
      {error && <p role="alert" className="mt-2 font-body text-xs text-error">{error}</p>}
    </div>
  );
}

export function ExpenseForm({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest">+ Add expense</button>;
  }

  return (
    <form ref={ref} className="rounded-card border border-sage/30 bg-offwhite p-5" action={(formData) => {
      setError(null);
      start(async () => {
        const result = await action(formData);
        if (result.ok) {
          ref.current?.reset();
          setOpen(false);
        } else setError(result.message);
      });
    }}>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Amount</span><input required name="amount" type="number" min="0" step="0.01" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" /></label>
        <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Merchant</span><input name="merchant" placeholder="Kroger, Etsy, rental company…" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" /></label>
        <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Category</span><input name="category" placeholder="Food, decor, rentals…" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" /></label>
        <label className="block"><span className="mb-1 block font-body text-sm font-semibold text-forest">Date</span><input name="expense_date" type="date" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block font-body text-sm font-semibold text-forest">Note</span><input name="note" placeholder="Optional note" className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest" /></label>
      </fieldset>
      {error && <p role="alert" className="mt-3 font-body text-sm text-error">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">{pending ? "Saving…" : "Save expense"}</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 font-body text-sm text-forest/65">Cancel</button>
      </div>
    </form>
  );
}

export function ReceiptUpload({ action }: { action: (formData: FormData) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} className="mt-2" action={(formData) => {
      setError(null);
      start(async () => {
        const result = await action(formData);
        if (result.ok) ref.current?.reset();
        else setError(result.message);
      });
    }}>
      <label className="inline-flex cursor-pointer items-center gap-2 font-body text-xs font-semibold text-forest/70">
        <span className="rounded-full border border-sage/35 px-3 py-1.5">{pending ? "Uploading…" : "Add receipt"}</span>
        <input name="receipt" type="file" accept="image/*" className="sr-only" disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
      {error && <p role="alert" className="mt-1 font-body text-xs text-error">{error}</p>}
    </form>
  );
}
