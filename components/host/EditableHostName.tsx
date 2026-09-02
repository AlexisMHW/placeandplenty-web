"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { getBrowserClient } from "@/lib/supabase-browser";

export default function EditableHostName({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    const next = value.trim().slice(0, 120);
    if (!next) {
      setError("Enter the name you want Place & Plenty to use.");
      return;
    }

    setError(null);
    startSaving(async () => {
      const supabase = getBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setError("Please sign in again.");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: next })
        .eq("id", user.id);

      if (updateError) {
        setError("That name didn’t save. Please try again.");
        return;
      }

      setValue(next);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hidden max-w-[13rem] items-center gap-2 rounded-lg border border-sage/40 px-3 py-2 font-body text-sm text-forest transition-colors duration-400 hover:bg-forest/5 sm:flex"
        title="Edit your name"
      >
        <Icon name="users" size={17} className="flex-shrink-0" />
        <span className="truncate">{value}</span>
        <span aria-hidden className="text-forest/45">✎</span>
      </button>
    );
  }

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <div>
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setValue(name);
              setError(null);
              setEditing(false);
            }
          }}
          maxLength={120}
          aria-label="Your name"
          className="w-44 rounded-lg border border-sage/45 bg-white px-3 py-2 font-body text-sm text-forest outline-none focus:border-forest"
        />
        {error && <p className="absolute mt-1 text-xs text-error">{error}</p>}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-forest px-3 py-2 font-body text-xs font-semibold text-offwhite disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(name);
          setError(null);
          setEditing(false);
        }}
        className="font-body text-xs text-forest/65"
      >
        Cancel
      </button>
    </div>
  );
}
