"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import type { ClosetItem } from "@/lib/host-data";
import {
  archiveClosetItem,
  restoreClosetItem,
  updateClosetItem,
} from "@/lib/host-actions";

// One thing the host owns, and the controls to keep it true.
//
// FREE. THE WHOLE CARD. Editing, quantities, colour, material, size,
// where it lives, the photo, and taking it out of the closet again are
// all basic inventory organisation, and the RLS policy behind them is
// `owner_user_id = auth.uid()` with no entitlement test. Do not add a
// gate here. The paid capability is Place & Plenty working out what you
// still need, which happens inside a gathering.
//
// ARCHIVE, NOT DELETE. "I don't have this any more" sets archived_at.
// Past gatherings hold gathering_closet_items rows pointing at this
// item, and the record that a host already owned something is the
// provenance behind a shopping quantity that was reduced. Deleting would
// take that with it. The card offers a real undo for the same reason.

export default function ClosetItemCard({
  item,
  photoUrl,
}: {
  item: ClosetItem;
  photoUrl?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const archived = Boolean(item.archived_at);

  const details = [
    item.quantity_owned && item.quantity_owned > 1
      ? `${item.quantity_owned}`
      : null,
    item.color,
    item.material,
    item.size_label,
    item.capacity_label,
  ].filter(Boolean);

  if (editing) {
    return (
      <li className="rounded-card border border-gold/50 bg-parchment p-4">
        <form
          action={(formData) => {
            setError(null);
            start(async () => {
              const result = await updateClosetItem(item.id, formData);
              if (result.ok) setEditing(false);
              else setError(result.message);
            });
          }}
        >
          <fieldset disabled={pending} className="contents">
            <div className="grid gap-3">
              <Input name="name" label="What is it" defaultValue={item.name} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="category" label="Kind of thing" defaultValue={item.category} />
                <Input
                  name="quantity_owned"
                  label="How many"
                  type="number"
                  defaultValue={item.quantity_owned ?? 1}
                />
                <Input name="color" label="Colour" defaultValue={item.color} />
                <Input name="material" label="Material" defaultValue={item.material} />
                <Input name="size_label" label="Size" defaultValue={item.size_label} />
                <Input
                  name="capacity_label"
                  label="Holds"
                  defaultValue={item.capacity_label}
                />
              </div>
              <Input
                name="notes"
                label="Where it lives"
                defaultValue={item.notes}
                placeholder="Top of the hall cupboard"
              />
              <label className="block">
                <span className="mb-1 block font-body text-sm font-semibold text-forest">
                  {item.storage_path ? "Replace the photo" : "Add a photo"}
                </span>
                <input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="w-full font-body text-sm text-forest/75"
                />
              </label>
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
    <li
      className={`overflow-hidden rounded-card border border-sage/30 bg-parchment ${
        archived ? "opacity-70" : ""
      }`}
    >
      {photoUrl && (
        <div className="relative aspect-[4/3] w-full bg-cream">
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="p-4">
        <p className="font-display text-lg text-forest">{item.name}</p>
        {details.length > 0 && (
          <p className="mt-0.5 font-body text-sm text-forest/65">
            {details.join(" · ")}
          </p>
        )}
        {item.notes && (
          <p className="mt-1 font-body text-sm text-forest/60">{item.notes}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {archived ? (
            <Action
              pending={pending}
              onClick={() =>
                run(start, setError, () => restoreClosetItem(item.id))
              }
              className="text-forest/70 hover:text-forest"
            >
              I have this again
            </Action>
          ) : (
            <>
              <Action
                pending={pending}
                onClick={() => setEditing(true)}
                className="text-forest/70 hover:text-forest"
              >
                Edit
              </Action>
              <Action
                pending={pending}
                onClick={() => {
                  if (!window.confirm(`Take ${item.name} out of your closet?`)) {
                    return;
                  }
                  run(start, setError, () => archiveClosetItem(item.id));
                }}
                className="text-forest/55 hover:text-error"
              >
                I don&rsquo;t have this any more
              </Action>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 font-body text-xs text-error">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

function run(
  start: (fn: () => void) => void,
  setError: (m: string | null) => void,
  action: () => Promise<{ ok: true } | { ok: false; message: string }>
) {
  setError(null);
  start(async () => {
    const result = await action();
    if (!result.ok) setError(result.message);
  });
}

function Action({
  pending,
  onClick,
  className,
  children,
}: {
  pending: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`font-body text-sm underline decoration-sage/50 underline-offset-4 transition-colors duration-400 disabled:opacity-50 ${className}`}
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
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
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
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        min={type === "number" ? 1 : undefined}
        className="w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
      />
    </label>
  );
}
