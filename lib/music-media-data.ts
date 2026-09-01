import { createClient } from "@/lib/supabase-server";

export interface MusicMediaRow {
  id: string;
  gathering_id: string;
  music_styles: string[];
  playlist_url: string | null;
  moments_notes: string | null;
  explicit_allowed: boolean | null;
  must_play_notes: string | null;
  do_not_play_notes: string | null;
  special_songs_notes: string | null;
  audio_needs: string[];
  visual_needs: string[];
}

export interface SongRequestRow {
  id: string;
  songTitle: string;
  artist: string | null;
  createdAt: string;
}

export interface MusicMediaWorkspaceData {
  entitled: boolean;
  effectiveStatus: string;
  media: MusicMediaRow | null;
  songRequests: SongRequestRow[];
}

export async function getMusicMediaWorkspaceData(
  gatheringId: string
): Promise<MusicMediaWorkspaceData> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("music_media_workspace", {
    p_gathering_id: gatheringId,
  });
  if (error) throw error;

  const payload = (data ?? {}) as Record<string, unknown>;
  return {
    entitled: payload.entitled === true,
    effectiveStatus: String(payload.effectiveStatus ?? "active"),
    media: (payload.media as MusicMediaRow | null) ?? null,
    songRequests: ((payload.songRequests ?? []) as SongRequestRow[]) ?? [],
  };
}
