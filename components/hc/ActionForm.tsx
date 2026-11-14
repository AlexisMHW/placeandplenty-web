"use client";
import { useFormState, useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { feedbackMessage, type ActionResult } from "@/lib/hc/lifecycle";

// A form that SHOWS the result of its server action. Success and error text come only from feedbackMessage() (known codes), never from the
// database. The status region is always present so screen readers announce the result; buttons disable while the action is pending.
type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
export interface FormButton { label: string; name?: string; value?: string; secondary?: boolean }

function Buttons({ buttons }: { buttons: FormButton[] }) {
  const { pending } = useFormStatus();
  return <>{buttons.map((b) => (
    <button key={b.label} type="submit" name={b.name} value={b.value} disabled={pending} aria-disabled={pending}
      className={b.secondary ? "rounded border border-forest/30 px-3 py-1 text-forest disabled:opacity-60" : "rounded bg-forest px-3 py-1 text-parchment disabled:opacity-60"}>
      {pending ? "Working..." : b.label}
    </button>))}</>;
}

export function ActionForm({ action, buttons, children, className }: { action: Action; buttons: FormButton[]; children?: ReactNode; className?: string }) {
  const [state, formAction] = useFormState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <Buttons buttons={buttons} />
      <p role="status" aria-live="polite" className={state ? `mt-1 w-full text-sm ${state.ok ? "text-forest" : "font-medium text-error"}` : "sr-only"}>
        {state ? feedbackMessage(state.code) : ""}
      </p>
    </form>
  );
}
