"use client";
import { useFormState, useFormStatus } from "react-dom";
import { messageFor } from "@/lib/admin/messages";

// Wraps a server action so the person ALWAYS sees the outcome (success or a plain-language reason). The action returns only a short
// known code; the database error text never reaches the browser. The button is disabled while the request runs (no double submit).
export interface ActionState { ok: boolean | null; code: string }
export const IDLE: ActionState = { ok: null, code: "" };

export function SubmitButton({ label, className, pendingLabel, name, value }: { label: string; className?: string; pendingLabel?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={className ?? "rounded bg-forest px-3 py-1 text-parchment disabled:opacity-60"}>{pending ? (pendingLabel ?? "Working…") : label}</button>;
}

export function ActionForm({ action, submitLabel, submitClassName, className, children, successText }: {
  action: (formData: FormData) => Promise<{ ok: boolean; code: string }>;
  submitLabel: string; submitClassName?: string; className?: string; children?: React.ReactNode; successText?: string;
}) {
  const [state, formAction] = useFormState(async (_prev: ActionState, fd: FormData): Promise<ActionState> => { try { return await action(fd); } catch { return { ok: false, code: "failed" }; } }, IDLE);
  return (
    <form action={formAction} className={className}>
      {children}
      {submitLabel ? <SubmitButton label={submitLabel} className={submitClassName} /> : null}
      {state.ok === true ? <p role="status" className="mt-1 text-xs text-forest">{successText ?? messageFor(state.code)}</p> : null}
      {state.ok === false ? <p role="alert" className="mt-1 text-xs text-error">{messageFor(state.code)}</p> : null}
    </form>
  );
}
