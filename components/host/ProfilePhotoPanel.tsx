"use client";

import { useState, useTransition } from "react";
import {
  removeProfileAvatar,
  setProfileAvatarSharing,
  uploadProfileAvatar,
} from "@/lib/profile-actions";

export default function ProfilePhotoPanel({
  avatarUrl,
  shareWithGuestBooks,
  initials,
}: {
  avatarUrl: string | null;
  shareWithGuestBooks: boolean;
  initials: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <section className="rounded-card border border-sage/25 bg-parchment p-5 shadow-soft">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
        Profile photo
      </p>
      <div className="mt-2 h-[2px] w-10 bg-gold" aria-hidden />

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sage/30 bg-cream">
          {avatarUrl ? (
            // Signed Supabase URL. Plain img avoids adding a temporary signed host to Next image config.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Your profile" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl text-forest/60">{initials || "P&P"}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-forest">Put a face with your name.</h3>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-forest/70">
            If another Place &amp; Plenty host already has your account email in My Guest Book, your photo can appear beside your name there. Your email is never exposed and your account is not searchable.
          </p>

          <form
            className="mt-4 flex flex-wrap items-center gap-3"
            action={(formData) => run(() => uploadProfileAvatar(formData))}
          >
            <input
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              className="max-w-full font-body text-sm text-forest/70"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-forest px-5 py-2 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
            >
              {pending ? "Saving…" : avatarUrl ? "Replace photo" : "Add photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(removeProfileAvatar)}
                className="font-body text-sm text-forest/60 underline decoration-sage/50 underline-offset-4 hover:text-error disabled:opacity-50"
              >
                Remove photo
              </button>
            )}
          </form>

          <label className="mt-5 flex max-w-xl items-start gap-3 rounded-card border border-sage/25 bg-cream px-4 py-3">
            <input
              type="checkbox"
              checked={shareWithGuestBooks}
              disabled={pending || !avatarUrl}
              onChange={(event) => run(() => setProfileAvatarSharing(event.target.checked))}
              className="mt-1 h-4 w-4 accent-forest"
            />
            <span>
              <span className="block font-body text-sm font-semibold text-forest">
                Show my photo to P&amp;P hosts who already have my email in My Guest Book
              </span>
              <span className="mt-1 block font-body text-xs leading-relaxed text-forest/60">
                You can turn this off anytime. Without a matching saved email, your photo is not available to that host.
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-error">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
