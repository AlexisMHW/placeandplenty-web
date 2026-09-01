"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export type MusicMediaActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type SoundtrackMoment = { moment: string; description: string };
export type SoundtrackSuggestionResult =
  | { ok: true; moments: SoundtrackMoment[] }
  | { ok: false; message: string };

function friendlyMusicError(raw: string): string {
  if (raw.includes("not_entitled")) {
    return "My Music & Media is available with a Gathering Pass or Plus.";
  }
  if (raw.includes("gathering_read_only") || raw.includes("archived")) {
    return "This gathering is finished, so its music plan is read-only.";
  }
  if (raw.includes("not_authorized")) {
    return "You no longer have access to edit this gathering.";
  }
  return "That music plan didn't save. Please try again.";
}

export async function saveMusicMediaWeb(
  gatheringId: string,
  input: {
    musicStyles: string[];
    playlistUrl: string;
    momentsNotes: string;
    explicitAllowed: boolean | null;
    mustPlayNotes: string;
    doNotPlayNotes: string;
    specialSongsNotes: string;
    audioNeeds: string[];
    visualNeeds: string[];
  }
): Promise<MusicMediaActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("music_media_upsert", {
    p_gathering_id: gatheringId,
    p_music_styles: input.musicStyles.map((value) => value.trim()).filter(Boolean).slice(0, 30),
    p_playlist_url: input.playlistUrl,
    p_moments_notes: input.momentsNotes,
    p_explicit_allowed: input.explicitAllowed,
    p_must_play_notes: input.mustPlayNotes,
    p_do_not_play_notes: input.doNotPlayNotes,
    p_special_songs_notes: input.specialSongsNotes,
    p_audio_needs: input.audioNeeds.map((value) => value.trim()).filter(Boolean).slice(0, 30),
    p_visual_needs: input.visualNeeds.map((value) => value.trim()).filter(Boolean).slice(0, 30),
  });

  if (error) return { ok: false, message: friendlyMusicError(error.message ?? "") };
  revalidatePath(`/host/g/${gatheringId}/music`);
  return { ok: true };
}

async function callSoundtrackFunction(
  body: Record<string, unknown>
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; code: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) return { ok: false, code: "not_authenticated" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, code: "server_misconfigured" };

  try {
    const response = await fetch(`${url}/functions/v1/help-me-build-my-soundtrack`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || payload?.error) {
      return { ok: false, code: String(payload?.error ?? `http_${response.status}`) };
    }
    return { ok: true, payload: payload ?? {} };
  } catch {
    return { ok: false, code: "network_error" };
  }
}

function soundtrackMessage(code: string): string {
  if (code.includes("not_entitled")) return "My Music & Media is available with a Gathering Pass or Plus.";
  if (code.includes("quota")) return "You've used the soundtrack AI allowance for this period.";
  if (code.includes("rate")) return "Give soundtrack suggestions a moment before asking again.";
  if (code.includes("archived") || code.includes("completed") || code.includes("cancelled")) {
    return "This gathering is finished, so no new soundtrack suggestions can run.";
  }
  return "Place & Plenty couldn't build that soundtrack just now. Please try again.";
}

export async function requestSoundtrackSuggestionWeb(
  gatheringId: string,
  input: {
    occasion?: string;
    theme?: string;
    mood?: string[];
    musicStylesSoFar?: string[];
    specialSongsNotes?: string;
  }
): Promise<SoundtrackSuggestionResult> {
  const supabase = createClient();
  const { data: workspace, error: workspaceError } = await supabase.rpc("music_media_workspace", {
    p_gathering_id: gatheringId,
  });
  if (workspaceError) return { ok: false, message: friendlyMusicError(workspaceError.message ?? "") };
  const state = (workspace ?? {}) as Record<string, unknown>;
  if (state.entitled !== true) return { ok: false, message: "My Music & Media is available with a Gathering Pass or Plus." };
  if (["completed", "cancelled", "archived"].includes(String(state.effectiveStatus))) {
    return { ok: false, message: "This gathering is finished, so no new soundtrack suggestions can run." };
  }

  const result = await callSoundtrackFunction({
    gatheringId,
    occasion: input.occasion,
    theme: input.theme,
    mood: input.mood,
    musicStylesSoFar: input.musicStylesSoFar,
    specialSongsNotes: input.specialSongsNotes,
  });
  if (!result.ok) return { ok: false, message: soundtrackMessage(result.code) };

  const moments = Array.isArray(result.payload.moments)
    ? result.payload.moments
        .map((row) => row as Record<string, unknown>)
        .map((row) => ({ moment: String(row.moment ?? ""), description: String(row.description ?? "") }))
        .filter((row) => row.moment.trim() || row.description.trim())
    : [];
  if (!moments.length) return { ok: false, message: "Place & Plenty couldn't build that soundtrack just now. Please try again." };
  return { ok: true, moments };
}

export async function addMusicMediaSuggestedTasksWeb(
  gatheringId: string,
  taskTitles: string[]
): Promise<MusicMediaActionResult> {
  const titles = Array.from(new Set(taskTitles.map((title) => title.trim()).filter(Boolean))).slice(0, 30);
  if (!titles.length) return { ok: true };

  const supabase = createClient();
  const { data: workspace, error: workspaceError } = await supabase.rpc("music_media_workspace", {
    p_gathering_id: gatheringId,
  });
  if (workspaceError) return { ok: false, message: friendlyMusicError(workspaceError.message ?? "") };
  const state = (workspace ?? {}) as Record<string, unknown>;
  if (state.entitled !== true) return { ok: false, message: "My Music & Media is available with a Gathering Pass or Plus." };
  if (["completed", "cancelled", "archived"].includes(String(state.effectiveStatus))) {
    return { ok: false, message: "This gathering is finished, so its checklist is read-only." };
  }

  const { data: category, error: categoryError } = await supabase
    .from("task_categories")
    .select("id")
    .eq("slug", "home_essentials")
    .single();
  if (categoryError || !category) return { ok: false, message: "Those suggested tasks couldn't be added." };

  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("title")
    .eq("gathering_id", gatheringId)
    .in("title", titles);
  if (existingError) return { ok: false, message: "Those suggested tasks couldn't be checked." };
  const existingTitles = new Set((existing ?? []).map((row) => String(row.title).toLowerCase()));
  const rows = titles
    .filter((title) => !existingTitles.has(title.toLowerCase()))
    .map((title) => ({
      gathering_id: gatheringId,
      category_id: category.id,
      title,
      priority: "optional",
      status: "not_started",
      due_at: null,
      generated_by_ai: false,
      user_modified: true,
    }));

  if (rows.length) {
    const { error } = await supabase.from("tasks").insert(rows);
    if (error) return { ok: false, message: "Those suggested tasks couldn't be added." };
  }

  revalidatePath(`/host/g/${gatheringId}/music`);
  revalidatePath(`/host/g/${gatheringId}`);
  return { ok: true };
}
