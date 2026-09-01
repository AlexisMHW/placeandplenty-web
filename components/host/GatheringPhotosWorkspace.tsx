"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteGatheringPhotoWeb,
  setGatheringPhotoHiddenWeb,
  uploadGatheringPhotoWeb,
} from "@/lib/gathering-photos-actions";
import type { GatheringPhotoWeb } from "@/lib/gathering-photos-data";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function GatheringPhotosWorkspace({
  gatheringId,
  editable,
  expiresAt,
  photos,
}: {
  gatheringId: string;
  editable: boolean;
  expiresAt: string;
  photos: GatheringPhotoWeb[];
}) {
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<GatheringPhotoWeb | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const visible = photos.filter((photo) => !photo.hidden);
  const hidden = photos.filter((photo) => photo.hidden);

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>, success: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? success : result.message);
      if (result.ok) setSelected(null);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-card border border-sage/25 bg-cream p-5 md:p-6">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">A finite gallery</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-forest">
              {visible.length} {visible.length === 1 ? "photo" : "photos"}
            </h2>
            {hidden.length > 0 && <p className="mt-1 font-body text-sm text-forest/60">{hidden.length} hidden</p>}
          </div>
          {expiresAt && (
            <p className="max-w-md font-body text-sm leading-relaxed text-forest/65">
              Photos are kept through {formatDate(expiresAt)}. Save anything you want to keep beyond the gathering’s gallery window.
            </p>
          )}
        </div>
      </section>

      {editable && (
        <section className="rounded-card border border-gold/35 bg-parchment p-5 shadow-softer">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Add to the gallery</p>
          <h3 className="mt-1 font-display text-xl text-forest">One more from your camera roll</h3>
          <form
            ref={formRef}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end"
            action={(formData) => {
              setMessage(null);
              startTransition(async () => {
                const result = await uploadGatheringPhotoWeb(gatheringId, formData);
                setMessage(result.ok ? "Photo added." : result.message);
                if (result.ok) formRef.current?.reset();
              });
            }}
          >
            <label className="font-body text-sm font-semibold text-forest">
              Photo
              <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full font-body text-sm text-forest/70" />
            </label>
            <label className="font-body text-sm font-semibold text-forest">
              Caption <span className="font-normal text-forest/45">optional</span>
              <input name="caption" maxLength={300} placeholder="A little context, if it needs any" className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-sm text-forest" />
            </label>
            <button type="submit" disabled={pending} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">
              {pending ? "Adding…" : "Add photo"}
            </button>
          </form>
        </section>
      )}

      {visible.length === 0 && hidden.length === 0 ? (
        <section className="rounded-card border border-sage/25 bg-offwhite p-7 text-center shadow-softer">
          <h3 className="font-display text-2xl text-forest">No photos yet.</h3>
          <p className="mx-auto mt-2 max-w-lg font-body text-sm leading-relaxed text-forest/65">
            When photo contributions are enabled, invited guests can add theirs from the guest experience. Hosts and co-hosts see the shared gallery here.
          </p>
        </section>
      ) : (
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((photo) => (
              <button key={photo.id} type="button" onClick={() => setSelected(photo)} className="overflow-hidden rounded-card border border-sage/25 bg-offwhite text-left shadow-softer">
                {photo.url ? <img src={photo.url} alt={photo.caption || "Gathering photo"} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-sage/10" />}
                <div className="p-3">
                  <p className="truncate font-body text-sm font-semibold text-forest">{photo.caption || "Gathering photo"}</p>
                  <p className="mt-1 font-body text-xs text-forest/50">{photo.uploadedByName ? `${photo.uploadedByName} · ` : ""}{formatDate(photo.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {hidden.length > 0 && (
        <section className="rounded-card border border-sage/25 bg-cream p-5">
          <button type="button" onClick={() => setShowHidden((value) => !value)} className="font-body text-sm font-semibold text-forest underline decoration-gold/50 underline-offset-4">
            {showHidden ? "Hide moderated photos" : `Show ${hidden.length} hidden ${hidden.length === 1 ? "photo" : "photos"}`}
          </button>
          {showHidden && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {hidden.map((photo) => (
                <button key={photo.id} type="button" onClick={() => setSelected(photo)} className="overflow-hidden rounded-card border border-sage/25 bg-offwhite text-left opacity-60">
                  {photo.url ? <img src={photo.url} alt={photo.caption || "Hidden gathering photo"} className="aspect-square w-full object-cover" /> : <div className="aspect-square bg-sage/10" />}
                  <p className="p-3 font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest/60">Hidden</p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl">
            <div className="mb-3 flex items-center justify-between gap-4 text-offwhite">
              <div>
                <p className="font-display text-xl">{selected.caption || "Gathering photo"}</p>
                {selected.uploadedByName && <p className="font-body text-sm text-offwhite/65">Added by {selected.uploadedByName}</p>}
              </div>
              <button type="button" onClick={() => setSelected(null)} className="font-body text-sm font-semibold">Close</button>
            </div>
            {selected.url && <img src={selected.url} alt={selected.caption || "Gathering photo"} className="max-h-[72vh] w-full object-contain" />}
            {editable && (
              <div className="mt-4 flex flex-wrap gap-4">
                <button type="button" disabled={pending} onClick={() => run(() => setGatheringPhotoHiddenWeb(gatheringId, selected.id, !selected.hidden), selected.hidden ? "Photo returned to the gallery." : "Photo hidden from the main gallery.")} className="rounded-full border border-offwhite/60 px-4 py-2 font-body text-sm font-semibold text-offwhite disabled:opacity-50">
                  {selected.hidden ? "Unhide" : "Hide"}
                </button>
                <button type="button" disabled={pending} onClick={() => { if (window.confirm("Permanently remove this photo from the gathering gallery?")) run(() => deleteGatheringPhotoWeb(gatheringId, selected.id), "Photo removed."); }} className="font-body text-sm font-semibold text-offwhite underline decoration-offwhite/40 underline-offset-4 disabled:opacity-50">
                  Delete permanently
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {message && <p role="status" className="font-body text-sm text-forest/70">{message}</p>}
    </div>
  );
}
