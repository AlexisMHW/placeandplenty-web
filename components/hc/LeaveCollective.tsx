"use client";
import { useState } from "react";
import { ActionForm } from "@/components/hc/ActionForm";
import { LEAVE_COPY } from "@/lib/hc/membership";
import { leaveCollective } from "@/app/(creator)/creator/actions";

// Self-service leave. Nothing happens until the member confirms in the dialog. The dialog text is the founder's exact wording.
export function LeaveCollective() {
  const [open, setOpen] = useState(false);
  const c = LEAVE_COPY.en;
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm text-forest underline">{c.open}</button>;
  }
  return (
    <section role="alertdialog" aria-modal="false" aria-labelledby="leave-title" aria-describedby="leave-body" className="space-y-3 rounded-lg border border-forest/20 bg-cream p-4">
      <h2 id="leave-title" className="font-display text-xl text-forest">{c.title}</h2>
      <div id="leave-body" className="space-y-2 text-sm">{c.body.map((p) => <p key={p}>{p}</p>)}</div>
      <div className="flex flex-wrap gap-2">
        <button type="button" autoFocus onClick={() => setOpen(false)} className="rounded bg-forest px-3 py-1 text-parchment">{c.keep}</button>
        <ActionForm action={leaveCollective} buttons={[{ label: c.leave, secondary: true }]} />
      </div>
    </section>
  );
}
