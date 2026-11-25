"use client";
import { ActionForm } from "@/components/hc/ActionForm";
import { REJOIN_COPY } from "@/lib/hc/membership";
import { rejoinCollective } from "@/app/(creator)/creator/actions";

// Shown only to a member whose status is "left". The database decides whether the return is instant or needs staff review.
export function RejoinCollective() {
  const c = REJOIN_COPY.en;
  return (
    <section aria-labelledby="rejoin-title" className="mt-3 space-y-2">
      <h2 id="rejoin-title" className="font-display text-lg text-forest">{c.title}</h2>
      <p className="text-sm">{c.body}</p>
      <ActionForm action={rejoinCollective} buttons={[{ label: c.button }]} />
    </section>
  );
}
