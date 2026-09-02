"use client";

import { useMemo, useState, useTransition } from "react";
import {
  analyzeStyleImagesWeb,
  deleteStyleImageWeb,
  matchStyleComponentsToClosetWeb,
  requestStyleSuggestionWeb,
  saveStyleBoardWeb,
  uploadStyleImageWeb,
  type StyleClosetMatch,
} from "@/lib/style-board-actions";
import type {
  StyleBoardRow,
  StyleComponentRow,
  StyleImageRow,
  StyleSynthesis,
  StyleSwatch,
} from "@/lib/style-board-data";

const MOOD_IDEAS = ["Warm", "Relaxed", "Elegant", "Playful", "Intimate", "Festive", "Cozy", "Modern"];

function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

export default function StyleBoardWorkspace({
  gatheringId,
  occasion,
  readOnly,
  board,
  images,
  components,
  synthesis,
}: {
  gatheringId: string;
  occasion: string;
  readOnly: boolean;
  board: StyleBoardRow | null;
  images: StyleImageRow[];
  components: StyleComponentRow[];
  synthesis: StyleSynthesis | null;
}) {
  const [theme, setTheme] = useState(board?.theme ?? "");
  const [palette, setPalette] = useState<StyleSwatch[]>(board?.palette ?? []);
  const [moods, setMoods] = useState<string[]>(board?.mood_descriptors ?? []);
  const [vision, setVision] = useState(board?.vision_notes ?? "");
  const [moodDraft, setMoodDraft] = useState("");
  const [suggestion, setSuggestion] = useState<{
    theme: string;
    palette: StyleSwatch[];
    moodDescriptors: string[];
    ideas?: string;
  } | null>(null);
  const [closetMatches, setClosetMatches] = useState<Record<string, StyleClosetMatch>>({});
  const [closetChecked, setClosetChecked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasBoard = useMemo(
    () => Boolean(theme || palette.length || moods.length || vision || images.length || components.length),
    [theme, palette.length, moods.length, vision, images.length, components.length]
  );

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? "Saved." : result.message);
    });
  }

  function toggleMood(mood: string) {
    if (readOnly) return;
    setMoods((current) =>
      current.some((item) => item.toLowerCase() === mood.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== mood.toLowerCase())
        : [...current, mood]
    );
  }

  function addMood() {
    const value = moodDraft.trim();
    if (!value || moods.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setMoods((current) => [...current, value]);
    setMoodDraft("");
  }

  function addSwatch() {
    if (palette.length >= 8) return;
    setPalette((current) => [...current, { hex: "#EFE6D6", label: "" }]);
  }

  function updateSwatch(index: number, patch: Partial<StyleSwatch>) {
    setPalette((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function requestSuggestion() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestStyleSuggestionWeb(gatheringId, {
        occasion,
        theme,
        moodDescriptors: moods,
        visionNotes: vision,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuggestion(result.value);
    });
  }

  function checkCloset() {
    setMessage(null);
    startTransition(async () => {
      const result = await matchStyleComponentsToClosetWeb(
        gatheringId,
        components.map((component) => ({
          id: component.id,
          name: component.component_name,
          category: component.component_type,
          searchTerms: component.search_terms ?? [],
        }))
      );
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setClosetMatches(Object.fromEntries(result.matches.map((match) => [match.componentId, match])));
      setClosetChecked(true);
      const found = result.matches.filter((match) => match.found).length;
      setMessage(found > 0 ? `You already have ${found} ${found === 1 ? "piece" : "pieces"} that may work.` : "No close Hosting Closet matches found yet.");
    });
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    setTheme(suggestion.theme);
    setPalette(suggestion.palette);
    setMoods(suggestion.moodDescriptors);
    if (suggestion.ideas && !vision.trim()) setVision(suggestion.ideas);
    setSuggestion(null);
    setMessage("Suggestion applied. Save when it feels right.");
  }

  return (
    <div className="mt-8 space-y-7">
      {!readOnly && (
        <div className="rounded-card border border-gold/40 bg-parchment p-5 shadow-softer">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">A little creative help</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl text-forest">Help Me Style It</h3>
              <p className="mt-1 max-w-xl font-body text-sm leading-relaxed text-forest/65">
                Start from what you already know—or from nothing at all. Place & Plenty gives you one cohesive direction to review before anything becomes part of your board.
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={requestSuggestion}
              className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
            >
              {pending ? "Thinking…" : "Suggest a direction"}
            </button>
          </div>

          {suggestion && (
            <div className="mt-5 rounded-card border border-sage/30 bg-offwhite p-5">
              <p className="font-display text-2xl text-forest">{suggestion.theme}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestion.palette.map((swatch) => (
                  <span key={`${swatch.hex}-${swatch.label ?? ""}`} className="inline-flex items-center gap-2 rounded-full border border-sage/30 px-3 py-1.5 font-body text-xs text-forest/75">
                    <span className="h-4 w-4 rounded-full border border-forest/10" style={{ backgroundColor: swatch.hex }} />
                    {swatch.label || swatch.hex}
                  </span>
                ))}
              </div>
              <p className="mt-3 font-body text-sm text-forest/70">{suggestion.moodDescriptors.join(" · ")}</p>
              {suggestion.ideas && <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">{suggestion.ideas}</p>}
              <div className="mt-4 flex gap-4">
                <button type="button" onClick={acceptSuggestion} className="rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite">Use this direction</button>
                <button type="button" onClick={() => setSuggestion(null)} className="font-body text-sm text-forest/60 underline decoration-sage/50 underline-offset-4">Not this one</button>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="rounded-card border border-sage/25 bg-offwhite p-6 shadow-softer">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">The direction</p>
        <label className="mt-4 block font-body text-sm font-semibold text-forest">Theme or look</label>
        <input
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          disabled={readOnly}
          placeholder="Warm harvest table, modern garden brunch…"
          className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-forest disabled:bg-cream/50"
        />

        <label className="mt-6 block font-body text-sm font-semibold text-forest">How should it feel?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOOD_IDEAS.map((mood) => {
            const selected = moods.some((item) => item.toLowerCase() === mood.toLowerCase());
            return (
              <button
                key={mood}
                type="button"
                disabled={readOnly}
                onClick={() => toggleMood(mood)}
                className={`rounded-full border px-3 py-1.5 font-body text-sm ${selected ? "border-forest bg-forest text-offwhite" : "border-sage/40 bg-white text-forest"}`}
              >
                {mood}
              </button>
            );
          })}
        </div>
        {!readOnly && (
          <div className="mt-3 flex max-w-md gap-2">
            <input
              value={moodDraft}
              onChange={(event) => setMoodDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addMood();
                }
              }}
              placeholder="Add your own mood word"
              className="min-w-0 flex-1 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest"
            />
            <button type="button" onClick={addMood} className="rounded-full border border-forest px-4 font-body text-sm font-semibold text-forest">Add</button>
          </div>
        )}
        {moods.filter((mood) => !MOOD_IDEAS.some((idea) => idea.toLowerCase() === mood.toLowerCase())).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {moods
              .filter((mood) => !MOOD_IDEAS.some((idea) => idea.toLowerCase() === mood.toLowerCase()))
              .map((mood) => (
                <button key={mood} type="button" disabled={readOnly} onClick={() => toggleMood(mood)} className="rounded-full border border-gold/45 bg-cream px-3 py-1.5 font-body text-sm text-forest">
                  {mood}{!readOnly ? " ×" : ""}
                </button>
              ))}
          </div>
        )}

        <label className="mt-6 block font-body text-sm font-semibold text-forest">Your colors</label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {palette.map((swatch, index) => (
            <div key={index} className="rounded-card border border-sage/25 bg-white p-3">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  disabled={readOnly}
                  value={/^#[0-9a-f]{6}$/i.test(swatch.hex) ? swatch.hex : "#EFE6D6"}
                  onChange={(event) => updateSwatch(index, { hex: event.target.value.toUpperCase() })}
                  className="h-10 w-10 rounded border-0 bg-transparent p-0"
                />
                <div className="min-w-0 flex-1">
                  <input
                    disabled={readOnly}
                    value={swatch.label ?? ""}
                    onChange={(event) => updateSwatch(index, { label: event.target.value })}
                    placeholder="Warm cream"
                    className="w-full border-0 bg-transparent p-0 font-body text-sm font-semibold text-forest outline-none"
                  />
                  <input
                    disabled={readOnly}
                    value={swatch.hex}
                    onChange={(event) => updateSwatch(index, { hex: normalizeHex(event.target.value) })}
                    className="mt-1 w-full border-0 bg-transparent p-0 font-body text-xs uppercase text-forest/55 outline-none"
                  />
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => setPalette((current) => current.filter((_, i) => i !== index))} className="font-body text-lg text-forest/40 hover:text-error" aria-label="Remove color">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {!readOnly && palette.length < 8 && (
          <button type="button" onClick={addSwatch} className="mt-3 font-body text-sm font-semibold text-forest underline decoration-gold/60 underline-offset-4">+ Add a color</button>
        )}

        <label className="mt-6 block font-body text-sm font-semibold text-forest">Vision notes</label>
        <textarea
          value={vision}
          onChange={(event) => setVision(event.target.value)}
          disabled={readOnly}
          rows={4}
          placeholder="What should this look like—or definitely not look like?"
          className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-sm leading-relaxed text-forest disabled:bg-cream/50"
        />

        {!readOnly && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveStyleBoardWeb(gatheringId, { theme, palette, moodDescriptors: moods, visionNotes: vision }))}
            className="mt-5 rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite disabled:opacity-50"
          >
            Save my Style Board
          </button>
        )}
      </section>

      <section className="rounded-card border border-sage/25 bg-cream p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">Inspiration</p>
            <h3 className="mt-1 font-display text-xl text-forest">Show P&P what you mean</h3>
            <p className="mt-1 max-w-xl font-body text-sm leading-relaxed text-forest/65">Add up to a handful of images you’re drawn to. The visual analysis reads the shared look; it does not guess brands, stores, prices, or products.</p>
          </div>
          {!readOnly && images.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => analyzeStyleImagesWeb(gatheringId))}
              className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest disabled:opacity-50"
            >
              {pending ? "Reading the board…" : "Analyze inspiration"}
            </button>
          )}
        </div>

        {images.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.map((image) => (
              <figure key={image.id} className="group overflow-hidden rounded-card border border-sage/25 bg-offwhite">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={image.caption || "Style inspiration"} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square bg-sage/10" />
                )}
                <figcaption className="p-3">
                  <p className="font-body text-xs text-forest/60">{image.caption || "Inspiration"}</p>
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => deleteStyleImageWeb(gatheringId, image.id, image.storage_path))}
                      className="mt-2 font-body text-xs text-forest/45 underline decoration-sage/50 underline-offset-4 hover:text-error"
                    >
                      Remove
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {!readOnly && (
          <form
            className="mt-5 rounded-card border border-dashed border-sage/50 bg-offwhite p-4"
            action={(formData) => run(() => uploadStyleImageWeb(gatheringId, formData))}
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="font-body text-sm font-semibold text-forest">
                Inspiration image
                <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-2 block w-full font-body text-sm text-forest/70" />
              </label>
              <label className="font-body text-sm font-semibold text-forest">
                Caption <span className="font-normal text-forest/50">optional</span>
                <input name="caption" placeholder="The candlelight, not the flowers" className="mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
              </label>
              <button type="submit" disabled={pending} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">Add image</button>
            </div>
          </form>
        )}
      </section>

      {synthesis && (
        <section className="rounded-card border border-gold/35 bg-parchment p-6">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">What your inspiration has in common</p>
          {synthesis.overallStyle && <h3 className="mt-2 font-display text-2xl text-forest">{synthesis.overallStyle}</h3>}
          {synthesis.summaryForHost && <p className="mt-3 font-body leading-relaxed text-forest/75">{synthesis.summaryForHost}</p>}
          {synthesis.sharedPalette?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {synthesis.sharedPalette.map((swatch) => (
                <span key={`${swatch.hex}-${swatch.name}`} className="inline-flex items-center gap-2 rounded-full border border-sage/30 bg-offwhite px-3 py-1.5 font-body text-xs text-forest/70">
                  <span className="h-4 w-4 rounded-full border border-forest/10" style={{ backgroundColor: swatch.hex }} />
                  {swatch.name}
                </span>
              ))}
            </div>
          ) : null}
          {synthesis.recurringMaterials?.length ? <p className="mt-4 font-body text-sm text-forest/65"><strong>Materials:</strong> {synthesis.recurringMaterials.join(" · ")}</p> : null}
          {synthesis.recurringMotifs?.length ? <p className="mt-2 font-body text-sm text-forest/65"><strong>Recurring details:</strong> {synthesis.recurringMotifs.join(" · ")}</p> : null}
          {synthesis.conflicts?.length ? <p className="mt-3 font-body text-sm text-forest/65"><strong>Worth noticing:</strong> {synthesis.conflicts.join(" ")}</p> : null}
        </section>
      )}

      {components.length > 0 && (
        <section className="rounded-card border border-sage/25 bg-offwhite p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">The pieces underneath the look</p>
              <h3 className="mt-1 font-display text-xl text-forest">What it’s made of</h3>
              <p className="mt-1 font-body text-sm text-forest/60">Descriptive search language only—never a guessed brand or product.</p>
            </div>
            {!closetChecked && (
              <button
                type="button"
                disabled={pending}
                onClick={checkCloset}
                className="rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest disabled:opacity-50"
              >
                {pending ? "Checking…" : "Check my Hosting Closet"}
              </button>
            )}
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {components.map((component) => {
              const match = closetMatches[component.id];
              return (
                <li key={component.id} className="rounded-card border border-sage/25 bg-cream p-4">
                  <p className="font-body font-semibold text-forest">{component.component_name}</p>
                  {(component.descriptor || component.component_type) && <p className="mt-1 font-body text-sm text-forest/60">{[component.descriptor, component.component_type].filter(Boolean).join(" · ")}</p>}
                  {component.search_terms?.length ? <p className="mt-2 font-body text-xs text-forest/50">Try: {component.search_terms.join(" · ")}</p> : null}
                  {closetChecked && match?.found && (
                    <div className="mt-3 rounded-md border border-gold/35 bg-offwhite px-3 py-2">
                      <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-goldInk">Already in your Hosting Closet</p>
                      <p className="mt-1 font-body text-sm text-forest/75">{match.name || component.component_name}{match.quantityOwned != null ? ` · ${match.quantityOwned} on hand` : ""}</p>
                    </div>
                  )}
                  {closetChecked && !match?.found && <p className="mt-3 font-body text-xs text-forest/45">No close Closet match found.</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!hasBoard && <p className="font-body text-sm text-forest/60">Your board can begin with a theme, a few mood words, one image—or all three.</p>}
      {message && <p role="status" className="font-body text-sm text-forest/70">{message}</p>}
    </div>
  );
}
