import { createClient, getUser } from "@/lib/supabase-server";

const AVATAR_BUCKET = "profile-avatars";

export interface ProfileAvatarState {
  avatarPath: string | null;
  avatarUrl: string | null;
  shareWithGuestBooks: boolean;
}

async function signAvatar(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function getProfileAvatarState(): Promise<ProfileAvatarState> {
  const user = await getUser();
  if (!user) {
    return { avatarPath: null, avatarUrl: null, shareWithGuestBooks: true };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_path, share_avatar_with_guest_books")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { avatarPath: null, avatarUrl: null, shareWithGuestBooks: true };
  }

  const avatarPath = data.avatar_path as string | null;
  return {
    avatarPath,
    avatarUrl: await signAvatar(avatarPath),
    shareWithGuestBooks: data.share_avatar_with_guest_books !== false,
  };
}

/**
 * Resolve avatars only for guest rows this signed-in host already owns.
 * The RPC matches against a verified P&P account email; it never exposes
 * an account search or returns an email address.
 */
export async function getGuestBookAvatarUrls(): Promise<Map<string, string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("guest_book_profile_avatars");
  if (error || !Array.isArray(data) || data.length === 0) return new Map();

  const rows = data as Array<{ guest_id: string; avatar_path: string | null }>;
  const uniquePaths = Array.from(
    new Set(rows.map((row) => row.avatar_path).filter((p): p is string => Boolean(p)))
  );

  const signedByPath = new Map<string, string>();
  await Promise.all(
    uniquePaths.map(async (path) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (!signError && signed?.signedUrl) signedByPath.set(path, signed.signedUrl);
    })
  );

  return new Map(
    rows.flatMap((row) => {
      if (!row.avatar_path) return [];
      const url = signedByPath.get(row.avatar_path);
      return url ? [[row.guest_id, url] as [string, string]] : [];
    })
  );
}
