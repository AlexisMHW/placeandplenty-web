import { createClient } from "@/lib/supabase-server";

export interface GatheringPhotoWeb {
  id: string;
  storagePath: string;
  caption: string | null;
  hidden: boolean;
  uploadedByName: string | null;
  expiresAt: string;
  createdAt: string;
  url: string | null;
}

export interface GatheringPhotoWorkspaceWeb {
  effectiveStatus: string;
  expiresAt: string;
  editable: boolean;
  photos: GatheringPhotoWeb[];
}

export async function getGatheringPhotoWorkspaceWeb(gatheringId: string): Promise<GatheringPhotoWorkspaceWeb> {
  const supabase = createClient();
  const [{ data: workspace, error: workspaceError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.rpc("gathering_photo_workspace", { p_gathering_id: gatheringId }),
    supabase
      .from("gathering_photos")
      .select("id, storage_path, caption, hidden_at, expires_at, created_at, guests(first_name)")
      .eq("gathering_id", gatheringId)
      .order("created_at", { ascending: false }),
  ]);
  if (workspaceError) throw workspaceError;
  if (rowsError) throw rowsError;

  const meta = (workspace ?? {}) as Record<string, unknown>;
  const photos = await Promise.all(
    (rows ?? []).map(async (row) => {
      const { data: signed } = await supabase.storage
        .from("gathering-photos")
        .createSignedUrl(row.storage_path, 3600);
      const guestValue = row.guests as { first_name?: string } | { first_name?: string }[] | null;
      const guest = Array.isArray(guestValue) ? guestValue[0] : guestValue;
      return {
        id: row.id,
        storagePath: row.storage_path,
        caption: row.caption ?? null,
        hidden: Boolean(row.hidden_at),
        uploadedByName: guest?.first_name ?? null,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        url: signed?.signedUrl ?? null,
      } satisfies GatheringPhotoWeb;
    })
  );

  return {
    effectiveStatus: String(meta.effectiveStatus ?? "active"),
    expiresAt: String(meta.expiresAt ?? ""),
    editable: meta.editable === true,
    photos,
  };
}
