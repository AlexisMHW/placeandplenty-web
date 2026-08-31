"use client";

import { useState, useTransition } from "react";
import type { SavedGuest } from "@/lib/host-data";
import {
  deleteGuestBookPerson,
  setGuestSaved,
  updateGuestBookPerson,
} from "@/lib/host-actions";

// One person in My Guest Book.
//
// THE CONTROL THAT MATTERS IS "KEEP" / "REMOVE FROM MY GUEST BOOK", and
// it writes `guests.is_saved`. It is not a delete and must never become
// one. Every RSVP, contribution, dietary note and household this person
// has ever been part of hangs off `gathering_guests` rows that reference
// this guest id. Unsaving takes them out of the reusable book and leaves
// all of it exactly where it is.
//
// DELETE IS OFFERED ONLY TO SOMEONE WITH NO HISTORY AT ALL — a person
// typed in by mistake five seconds ago. The check is in the server
// action, not here, because the honest answer for a person WITH history
// is "unsave them instead", and that needs a real count rather than a
// guess made in the browser.

export default function GuestBookEntry({
  guest,
  saved,
}: {
  guest: SavedGuest;
  /** Which section this card is rendered in. Changes the offer, not the data. */
  saved: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const notes = [
    guest.dietary_notes,
    guest.allergy_notes,
    guest.accessibility_notes,
  ].filter(Boolean);

  function run(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>
  ) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
      else setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="rounded-card border border-gold/50 bg-parchment p-4">
        <form
          action={(formData) =>
            run(() => updateGuestBookPerson(guest.id, formData))
          }
        >
          <fieldset disabled={pending} className="contents">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="first_name" label="First name" required defaultValue={guest.first_name} />
              <Input name="last_name" label="Last name" defaultValue={guest.last_name} />
              <Input name="household_name" label="Household" defaultValue={guest.household_name} />
              <Input name="email" label="Email" type="email" defaultValue={guest.email} />
              <Input name="phone" label="Phone" defaultValue={guest.phone} />
              <Input name="dietary_notes" label="Dietary" defaultValue={guest.dietary_notes} />
              <Input name="allergy_notes" label="Allergies" defaultValue={guest.allergy_notes} />
              <Input
                name="accessibility_notes"
                label="Accessibility"
                defaultValue={guest.accessibility_notes}
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 font-body text-sm text-error">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-forest px-5 py-2 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded-full px-4 py-2 font-body text-sm text-forest/70 hover:text-forest"
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-card border border-sage/30 bg-parchment p-4">
      <p className="font-display text-lg text-forest">
        {[guest.first_name, guest.last_name].filter(Boolean).join(" ")}
      </p>
      {guest.household_name && (
        <p className="font-body text-sm text-forest/65">{guest.household_name}</p>
      )}
      {(guest.email || guest.phone) && (
        <p className="mt-1 font-body text-sm text-forest/55">
          {[guest.email, guest.phone].filter(Boolean).join(" · ")}
        </p>
      )}
      {notes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {notes.map((n, i) => (
            <li
              key={i}
              className="rounded-full border border-sage/40 px-2.5 py-0.5 font-body text-xs text-forest/70"
            >
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Action pending={pending} onClick={() => setEditing(true)}>
          Edit
        </Action>

        {saved ? (
          <Action
            pending={pending}
            onClick={() => run(() => setGuestSaved(guest.id, false))}
            tone="quiet"
          >
            Remove from my guest book
          </Action>
        ) : (
          <Action
            pending={pending}
            onClick={() => run(() => setGuestSaved(guest.id, true))}
          >
            Keep in my guest book
          </Action>
        )}

        <Action
          pending={pending}
          tone="danger"
          onClick={() => {
            if (
              !window.confirm(
                `Delete ${guest.first_name} completely? This only works if they've never been to a gathering.`
              )
            ) {
              return;
            }
            run(() => deleteGuestBookPerson(guest.id));
          }}
        >
          Delete
        </Action>
      </div>

      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-error">
          {error}
        </p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

function Action({
  pending,
  onClick,
  children,
  tone = "normal",
}: {
  pending: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "normal" | "quiet" | "danger";
}) {
  const colour =
    tone === "danger"
      ? "text-forest/50 hover:text-error"
      : tone === "quiet"
        ? "text-forest/60 hover:text-forest"
        : "text-forest/75 hover:text-forest";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`font-body text-sm underline decoration-sage/50 underline-offset-4 transition-colors duration-400 disabled:opacity-50 ${colour}`}
    >
      {children}
    </button>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-sm font-semibold text-forest">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? undefined}
        className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
      />
    </label>
  );
}
