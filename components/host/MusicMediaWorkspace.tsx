"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addMusicMediaSuggestedTasksWeb,
  requestSoundtrackSuggestionWeb,
  saveMusicMediaWeb,
  type SoundtrackMoment,
} from "@/lib/music-media-actions";
import type { MusicMediaRow, SongRequestRow } from "@/lib/music-media-data";

const MUSIC_STYLES = [
  "R&B", "Jazz", "Soul", "Motown", "Throwbacks", "Hip-Hop", "Pop", "Country",
  "Rock", "Instrumental", "Classical", "Kids", "Holiday", "Gospel", "Dance", "Mixed / Eclectic",
];
const AUDIO_NEEDS = ["Bluetooth speaker", "Multiple speakers", "PA / sound system", "Microphone", "DJ", "Live music"];
const VISUAL_NEEDS = ["TV", "Projector", "Projection screen", "Slideshow", "Photo/video montage", "Photo booth", "Digital photo frame"];
const TASKS: Record<string, string[]> = {
  "Bluetooth speaker": ["Charge/bring Bluetooth speaker", "Test Bluetooth pairing"],
  "Multiple speakers": ["Confirm speaker placement", "Test speaker pairing/sync"],
  "PA / sound system": ["Confirm sound system", "Test sound levels", "Confirm power requirements"],
  Microphone: ["Confirm microphone", "Test microphone"],
  DJ: ["Confirm DJ", "Share event timeline with DJ", "Send must-play songs", "Send do-not-play list", "Confirm DJ setup time", "Confirm power requirements for DJ"],
  "Live music": ["Confirm live music act", "Share event timeline", "Confirm setup time", "Confirm power requirements"],
  TV: ["Confirm TV access and setup"],
  Projector: ["Confirm projector", "Bring necessary adapter/cable", "Test projector and sound"],
  "Projection screen": ["Confirm projection screen"],
  Slideshow: ["Collect photos for slideshow", "Create slideshow", "Test slideshow"],
  "Photo/video montage": ["Collect photos/videos for montage", "Create montage", "Test montage playback"],
  "Photo booth": ["Confirm photo booth setup", "Confirm space/backdrop", "Confirm power requirements"],
  "Digital photo frame": ["Load photos onto digital photo frame"],
};

type ExplicitPreference = "allowed" | "not_allowed" | "no_preference";

function ChipPicker({ options, selected, setSelected, disabled, placeholder }: {
  options: string[];
  selected: string[];
  setSelected: (values: string[]) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const all = [...options, ...selected.filter((value) => !options.includes(value))];
  function toggle(value: string) {
    if (disabled) return;
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }
  function add() {
    const value = draft.trim();
    if (!value || selected.includes(value)) return;
    setSelected([...selected, value]);
    setDraft("");
  }
  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((value) => {
          const active = selected.includes(value);
          return (
            <button key={value} type="button" disabled={disabled} onClick={() => toggle(value)} className={`rounded-full border px-3 py-1.5 font-body text-sm disabled:cursor-default ${active ? "border-forest bg-forest text-offwhite" : "border-sage/40 bg-white text-forest"}`}>
              {value}
            </button>
          );
        })}
      </div>
      {!disabled && (
        <div className="mt-3 flex max-w-md gap-2">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={placeholder} className="min-w-0 flex-1 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
          <button type="button" onClick={add} className="rounded-full border border-forest px-4 font-body text-sm font-semibold text-forest">Add</button>
        </div>
      )}
    </div>
  );
}

export default function MusicMediaWorkspace({ gatheringId, occasion, styleTheme, styleMood, readOnly, media, songRequests }: {
  gatheringId: string;
  occasion: string;
  styleTheme: string | null;
  styleMood: string[];
  readOnly: boolean;
  media: MusicMediaRow | null;
  songRequests: SongRequestRow[];
}) {
  const [musicStyles, setMusicStyles] = useState(media?.music_styles ?? []);
  const [playlistUrl, setPlaylistUrl] = useState(media?.playlist_url ?? "");
  const [momentsNotes, setMomentsNotes] = useState(media?.moments_notes ?? "");
  const [explicitPreference, setExplicitPreference] = useState<ExplicitPreference>(media?.explicit_allowed === true ? "allowed" : media?.explicit_allowed === false ? "not_allowed" : "no_preference");
  const [mustPlayNotes, setMustPlayNotes] = useState(media?.must_play_notes ?? "");
  const [doNotPlayNotes, setDoNotPlayNotes] = useState(media?.do_not_play_notes ?? "");
  const [specialSongsNotes, setSpecialSongsNotes] = useState(media?.special_songs_notes ?? "");
  const [audioNeeds, setAudioNeeds] = useState(media?.audio_needs ?? []);
  const [visualNeeds, setVisualNeeds] = useState(media?.visual_needs ?? []);
  const [suggestion, setSuggestion] = useState<SoundtrackMoment[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tasksAdded, setTasksAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  const suggestedTasks = useMemo(() => Array.from(new Set([...audioNeeds, ...visualNeeds].flatMap((need) => TASKS[need] ?? []))), [audioNeeds, visualNeeds]);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveMusicMediaWeb(gatheringId, {
        musicStyles,
        playlistUrl,
        momentsNotes,
        explicitAllowed: explicitPreference === "allowed" ? true : explicitPreference === "not_allowed" ? false : null,
        mustPlayNotes,
        doNotPlayNotes,
        specialSongsNotes,
        audioNeeds,
        visualNeeds,
      });
      setMessage(result.ok ? "Saved." : result.message);
    });
  }

  function requestSuggestion() {
    setMessage(null);
    startTransition(async () => {
      const result = await requestSoundtrackSuggestionWeb(gatheringId, {
        occasion,
        theme: styleTheme ?? undefined,
        mood: styleMood.length ? styleMood : undefined,
        musicStylesSoFar: musicStyles.length ? musicStyles : undefined,
        specialSongsNotes: specialSongsNotes || undefined,
      });
      if (!result.ok) { setMessage(result.message); return; }
      setSuggestion(result.moments);
    });
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    setMomentsNotes(suggestion.map((item) => `${item.moment}: ${item.description}`).join("\n"));
    setSuggestion(null);
    setMessage("Soundtrack direction applied. Save when it feels right.");
  }

  function addTasks() {
    setMessage(null);
    startTransition(async () => {
      const result = await addMusicMediaSuggestedTasksWeb(gatheringId, suggestedTasks);
      if (!result.ok) { setMessage(result.message); return; }
      setTasksAdded(true);
      setMessage("Suggested tasks added to your plan.");
    });
  }

  const inputClass = "mt-2 w-full rounded-md border border-sage/40 bg-white px-3 py-2.5 font-body text-sm text-forest disabled:bg-cream/50";

  return (
    <div className="mt-8 space-y-7">
      {!readOnly && (
        <section className="rounded-card border border-gold/40 bg-parchment p-5 shadow-softer">
          <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">A little soundtrack help</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-xl text-forest">Help Me Build My Soundtrack</h3>
              <p className="mt-1 max-w-xl font-body text-sm leading-relaxed text-forest/65">Use the gathering, your Style Board and what matters to you to shape the music through the day.</p>
            </div>
            <button type="button" disabled={pending} onClick={requestSuggestion} className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite disabled:opacity-50">{pending ? "Thinking…" : "Suggest the soundtrack"}</button>
          </div>
          {suggestion && (
            <div className="mt-5 rounded-card border border-sage/30 bg-offwhite p-5">
              <div className="space-y-3">
                {suggestion.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[0.8fr_2fr]">
                    <input value={item.moment} onChange={(event) => setSuggestion((current) => current?.map((row, i) => i === index ? { ...row, moment: event.target.value } : row) ?? null)} className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm font-semibold text-forest" />
                    <textarea value={item.description} onChange={(event) => setSuggestion((current) => current?.map((row, i) => i === index ? { ...row, description: event.target.value } : row) ?? null)} rows={2} className="rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-sm text-forest" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4">
                <button type="button" onClick={acceptSuggestion} className="rounded-full bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite">Use this direction</button>
                <button type="button" disabled={pending} onClick={requestSuggestion} className="font-body text-sm text-forest/65 underline decoration-gold/60 underline-offset-4">Try another</button>
                <button type="button" onClick={() => setSuggestion(null)} className="font-body text-sm text-forest/55">Cancel</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-card border border-sage/25 bg-offwhite p-6 shadow-softer">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">The sound</p>
        <label className="mt-4 block font-body text-sm font-semibold text-forest">What should it sound like?</label>
        <ChipPicker options={MUSIC_STYLES} selected={musicStyles} setSelected={setMusicStyles} disabled={readOnly} placeholder="Add another style" />

        <label className="mt-6 block font-body text-sm font-semibold text-forest">Playlist link</label>
        <input value={playlistUrl} onChange={(event) => setPlaylistUrl(event.target.value)} disabled={readOnly} placeholder="Spotify, Apple Music, YouTube…" className={inputClass} />

        <label className="mt-6 block font-body text-sm font-semibold text-forest">Moments that need something</label>
        <p className="mt-1 font-body text-xs text-forest/55">Arrival music, dinner, cake, a toast, cleanup—anything that should have its own feel.</p>
        <textarea value={momentsNotes} onChange={(event) => setMomentsNotes(event.target.value)} disabled={readOnly} rows={5} className={inputClass} />
      </section>

      <section className="rounded-card border border-sage/25 bg-cream p-6">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">The preferences</p>
        <label className="mt-4 block font-body text-sm font-semibold text-forest">Explicit music</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["allowed", "not_allowed", "no_preference"] as ExplicitPreference[]).map((value) => (
            <button key={value} type="button" disabled={readOnly} onClick={() => setExplicitPreference(value)} className={`rounded-full border px-3 py-1.5 font-body text-sm ${explicitPreference === value ? "border-forest bg-forest text-offwhite" : "border-sage/40 bg-white text-forest"}`}>
              {value === "allowed" ? "Allowed" : value === "not_allowed" ? "Keep it clean" : "No preference"}
            </button>
          ))}
        </div>
        <label className="mt-5 block font-body text-sm font-semibold text-forest">Must play</label>
        <input value={mustPlayNotes} onChange={(event) => setMustPlayNotes(event.target.value)} disabled={readOnly} className={inputClass} />
        <label className="mt-5 block font-body text-sm font-semibold text-forest">Please don't play</label>
        <input value={doNotPlayNotes} onChange={(event) => setDoNotPlayNotes(event.target.value)} disabled={readOnly} className={inputClass} />
        <label className="mt-5 block font-body text-sm font-semibold text-forest">Songs that matter</label>
        <input value={specialSongsNotes} onChange={(event) => setSpecialSongsNotes(event.target.value)} disabled={readOnly} className={inputClass} />
      </section>

      <section className="rounded-card border border-sage/25 bg-offwhite p-6 shadow-softer">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">What the setup needs</p>
        <label className="mt-4 block font-body text-sm font-semibold text-forest">Audio</label>
        <ChipPicker options={AUDIO_NEEDS} selected={audioNeeds} setSelected={(values) => { setAudioNeeds(values); setTasksAdded(false); }} disabled={readOnly} placeholder="Add another audio need" />
        <label className="mt-6 block font-body text-sm font-semibold text-forest">Visuals & media</label>
        <ChipPicker options={VISUAL_NEEDS} selected={visualNeeds} setSelected={(values) => { setVisualNeeds(values); setTasksAdded(false); }} disabled={readOnly} placeholder="Add another visual need" />

        {!readOnly && suggestedTasks.length > 0 && !tasksAdded && (
          <div className="mt-6 rounded-card border border-gold/35 bg-parchment p-5">
            <h3 className="font-display text-lg text-forest">Suggested tasks</h3>
            <p className="mt-1 font-body text-sm text-forest/65">These come directly from the setup you chose. Nothing is added unless you say so.</p>
            <ul className="mt-3 space-y-1 font-body text-sm text-forest/75">
              {suggestedTasks.map((task) => <li key={task}>• {task}</li>)}
            </ul>
            <button type="button" disabled={pending} onClick={addTasks} className="mt-4 rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest disabled:opacity-50">Add selected tasks</button>
          </div>
        )}
      </section>

      <section className="rounded-card border border-sage/25 bg-cream p-6">
        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-goldInk">From your guests</p>
        <h3 className="mt-1 font-display text-xl text-forest">What your guests asked for</h3>
        <p className="mt-1 font-body text-sm text-forest/60">Song requests stay about the song—not who asked for it.</p>
        {songRequests.length === 0 ? (
          <p className="mt-4 font-body text-sm text-forest/65">No requests yet. Guests can add one from their invitation.</p>
        ) : (
          <ul className="mt-4 divide-y divide-sage/20">
            {songRequests.map((request) => (
              <li key={request.id} className="py-3 font-body text-base text-forest">
                {request.songTitle}{request.artist ? <span className="text-forest/60"> — {request.artist}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!readOnly && (
        <button type="button" disabled={pending} onClick={save} className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite disabled:opacity-50">{pending ? "Saving…" : "Save My Music & Media"}</button>
      )}
      {message && <p className="font-body text-sm text-forest/70" role="status">{message}</p>}
    </div>
  );
}
