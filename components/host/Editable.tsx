"use client";

import { useState, useTransition, useRef, type ReactNode } from "react";
import type { ActionResult } from "@/lib/host-actions";

// Shared interaction primitives for the host workspace.
//
// ONE PATTERN, USED EVERYWHERE: optimistic-feeling but not optimistic.
// Every control below disables while its action is in flight and shows
// the server's message on failure. Nothing is rendered as done before
// the server says so — a menu item that appears instantly and vanishes a
// second later because the gathering was archived is worse than a
// half-second wait.
//
// useTransition rather than useFormState: these actions take arguments
// beyond FormData (gathering id, row id, the new status), and the
// pending flag is what the UI actually needs.
//
// ERRORS ARE SHOWN IN PLACE, next to the control that failed, with
// role="alert" so they are announced. A toast at the corner of the
// screen would be missed by exactly the person who most needs it.

/* ------------------------------------------------------------------ */

export function ActionButton({
  action,
  children,
  className = "",
  confirm,
  title,
}: {
  action: () => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  /** Shown in a native confirm() first. For destructive actions only. */
  confirm?: string;
  title?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        title={title}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const result = await action();
            if (!result.ok) setError(result.message);
          });
        }}
        className={`${className} disabled:opacity-50`}
      >
        {children}
      </button>
      {error && (
        <span role="alert" className="ml-2 font-body text-xs text-error">
          {error}
        </span>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A small select that fires an action on change.
 *
 * Reverts to its previous value if the write fails, so the control never
 * shows a state the database rejected.
 */
export function StatusSelect({
  value,
  options,
  action,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  action: (next: string) => Promise<ActionResult>;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <select
        aria-label={label}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const previous = current;
          setCurrent(next);
          setError(null);
          start(async () => {
            const result = await action(next);
            if (!result.ok) {
              setCurrent(previous);
              setError(result.message);
            }
          });
        }}
        className="rounded-md border border-sage/40 bg-offwhite px-2.5 py-1 font-body text-sm text-forest disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="mt-1 font-body text-xs text-error">
          {error}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A disclosure that opens an inline add form.
 *
 * Collapsed by default so a populated surface stays about its contents
 * rather than about a form. The form resets and closes on success and
 * stays open with its values on failure — retyping a dish because the
 * network blipped is a small cruelty.
 */
export function AddForm({
  label,
  submitLabel,
  action,
  children,
}: {
  label: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
      >
        <span aria-hidden>+</span>
        {label}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      className="mt-6 rounded-card border border-sage/30 bg-offwhite p-5"
      action={(formData) => {
        setError(null);
        start(async () => {
          const result = await action(formData);
          if (result.ok) {
            formRef.current?.reset();
            setOpen(false);
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}

        {error && (
          <p role="alert" className="mt-3 font-body text-sm text-error">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-full px-4 py-2.5 font-body text-sm text-forest/70 transition-colors duration-400 hover:text-forest"
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

/* ------------------------------------------------------------------ */

/** A labelled input, sized for the inline add forms. */
export function Field({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  className = "",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  defaultValue?: string | number | null;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-body text-sm font-semibold text-forest">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "any" : undefined}
        className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
      />
    </label>
  );
}
