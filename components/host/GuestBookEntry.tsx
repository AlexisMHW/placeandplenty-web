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
// Profile photos are decoration resolved from a matching VERIFIED P&P
// account email. They are never copied into this guest row, so changing
// or removing a profile photo updates everywhere automatically and the
// host never owns someone else's image data.

export default function GuestBookEntry({
  guest,
  saved,
  avatarUrl,
}: {
  guest: SavedGuest;
  /** Which section this card is rendered in. Changes the offer, not the data. */
  saved: boolean;
  avatarUrl?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const notes = [
    guest.dietary_notes,
    guest.allergy_notes,
    guest.accessibility_notes,
  ].filter(Boolean);
  const initials = [guest.first_name, guest.last_name]
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => String(part)[0]?.toUpperCase())
    .join("");

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
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sage/30 bg-cream">
          {avatarUrl ? (
            // Private signed URL returned only after an authorized email match.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-sm text-forest/60">{initials || "—"}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
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
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
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
