"use client";

import { useMemo, useState } from "react";
import {
  FIND_HELP_CATEGORIES,
  externalMapsSearchUrl,
  getFindHelpCategory,
} from "@/lib/find-help";

export default function FindHelpWorkspace({
  initialArea,
  initialCategory,
  initialNeed,
}: {
  initialArea: string;
  initialCategory?: string | null;
  initialNeed?: string | null;
}) {
  const seeded = getFindHelpCategory(initialCategory);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(seeded?.slug ?? null);
  const [customDraft, setCustomDraft] = useState(initialNeed ?? "");
  const [customNeed, setCustomNeed] = useState<string | null>(initialNeed?.trim() || null);
  const [searchArea, setSearchArea] = useState(initialArea);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => getFindHelpCategory(selectedSlug), [selectedSlug]);
  const need = selected?.label ?? customNeed;

  function chooseCategory(slug: string) {
    setSelectedSlug(slug);
    setCustomNeed(null);
    setError(null);
  }

  function commitCustom() {
    const value = customDraft.trim();
    if (!value) return;
    setSelectedSlug(null);
    setCustomNeed(value);
    setError(null);
  }

  function resetNeed() {
    setSelectedSlug(null);
    setCustomNeed(null);
    setCustomDraft("");
    setError(null);
  }

  function search() {
    if (!need) {
      setError("Choose a category or tell us what you need.");
      return;
    }
    if (!searchArea.trim()) {
      setError("Add a city or area to search.");
      return;
    }
    setError(null);
    window.open(externalMapsSearchUrl(need, searchArea), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-8">
      {!need ? (
        <>
          <p className="font-display text-xl text-forest">What do you need?</p>
          <p className="mt-1 font-body text-sm leading-relaxed text-forest/65">
            Start with a common category, or type exactly what you’re looking for.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {FIND_HELP_CATEGORIES.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => chooseCategory(category.slug)}
                className="rounded-full border border-gold/55 bg-offwhite px-4 py-2 font-body text-sm font-semibold text-forest transition hover:bg-cream"
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="mt-7 rounded-card border border-sage/30 bg-parchment p-5">
            <label className="block font-body text-sm font-semibold text-forest">
              Something else?
            </label>
            <p className="mt-1 font-body text-sm text-forest/60">
              Babysitter, valet, knife sharpener, interpreter—if you can name it, you can search for it.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <input
                value={customDraft}
                onChange={(event) => setCustomDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustom();
                  }
                }}
                placeholder="What are you looking for?"
                className="min-w-0 flex-1 rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-sm text-forest"
              />
              <button
                type="button"
                onClick={commitCustom}
                disabled={!customDraft.trim()}
                className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
              >
                Use this
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">
                Looking for
              </p>
              <p className="mt-1 font-display text-2xl text-forest">{need}</p>
            </div>
            <button
              type="button"
              onClick={resetNeed}
              className="font-body text-sm text-forest/60 underline decoration-sage/50 underline-offset-4 hover:text-forest"
            >
              Change
            </button>
          </div>

          <label className="mt-6 block font-body text-sm font-semibold text-forest">
            Search area
          </label>
          <input
            value={searchArea}
            onChange={(event) => setSearchArea(event.target.value)}
            placeholder="Nashville, TN"
            className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-sm text-forest"
          />

          {error && <p className="mt-3 font-body text-sm text-error">{error}</p>}

          <button
            type="button"
            onClick={search}
            className="mt-5 rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition hover:bg-forest/90"
          >
            Search nearby
          </button>

          <p className="mt-3 font-body text-xs leading-relaxed text-forest/55">
            This opens an external Google Maps search using only the service you chose and the area you enter here. Place & Plenty does not send guest information, private notes, photos, or your gathering address.
          </p>
        </div>
      )}

      {error && !need && <p className="mt-3 font-body text-sm text-error">{error}</p>}
    </div>
  );
}
