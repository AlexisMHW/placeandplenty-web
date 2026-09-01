"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/host/Editable";
import { updateGatheringDetails } from "@/lib/host-actions";
import type { GatheringSummary } from "@/lib/host-data";

// Always-visible form rather than the AddForm disclosure: this page exists
// to edit these fields, so hiding them behind a button would put a click in
// front of the only thing here.
//
// Lifecycle actions are intentionally separate below this form. These fields
// are ordinary gathering details; finish/cancel/Gather Again have their own
// canonical RPC authority and should never look like another settings dropdown.
// Archival is automatic and archived gatherings are read-only history.

export default function GatheringSettingsForm({
  gathering,
}: {
  gathering: GatheringSummary;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  return (
    <form
      className="mt-8 max-w-2xl"
      action={(formData) => {
        setMessage(null);
        start(async () => {
          const result = await updateGatheringDetails(gathering.id, formData);
          setMessage(
            result.ok
              ? { kind: "ok", text: "Saved." }
              : { kind: "error", text: result.message }
          );
        });
      }}
    >
      <fieldset disabled={pending} className="contents">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="name"
            label="What you're calling it"
            required
            defaultValue={gathering.name}
            className="sm:col-span-2"
          />
          <Field
            name="gathering_date"
            label="Date"
            type="date"
            defaultValue={gathering.gathering_date}
          />
          <Field
            name="arrival_time"
            label="When people arrive"
            type="time"
            defaultValue={gathering.arrival_time?.slice(0, 5)}
          />
          <Field
            name="location_name"
            label="Where"
            defaultValue={gathering.location_name}
            placeholder="Home"
            className="sm:col-span-2"
          />
          <Field
            name="adult_count"
            label="Adults"
            type="number"
            defaultValue={gathering.adult_count}
          />
          <Field
            name="child_count"
            label="Children"
            type="number"
            defaultValue={gathering.child_count}
          />
        </div>

        <p className="mt-2 font-body text-sm text-forest/60">
          Expected guests is worked out from these two.
        </p>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`mt-5 rounded-lg border px-4 py-3 font-body text-sm ${
              message.kind === "error"
                ? "border-error/30 bg-offwhite text-error"
                : "border-sage/35 bg-parchment text-forest"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          className="mt-6 rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </fieldset>

      <p className="mt-8 font-body text-sm leading-relaxed text-forest/65">
        Moving the date or time may notify guests who have already replied.
        Finishing, cancelling, and Gather Again live in their own section below;
        old gatherings archive automatically and remain read-only history.
      </p>
    </form>
  );
}
