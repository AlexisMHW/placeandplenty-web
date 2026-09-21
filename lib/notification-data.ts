import { createClient, getUser } from "@/lib/supabase-server";

export type HostNotification = {
  id: string;
  gatheringId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  deepLinkPath: string | null;
};

export async function getHostNotifications(): Promise<HostNotification[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("host_notifications")
    .select("id, gathering_id, type, title, body, read_at, created_at, deep_link_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    gatheringId: row.gathering_id ? String(row.gathering_id) : null,
    type: String(row.type ?? ""),
    title: String(row.title ?? ""),
    body: row.body ? String(row.body) : null,
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
    deepLinkPath: row.deep_link_path ? String(row.deep_link_path) : null,
  }));
}

export function resolveNotificationWebPath(notification: HostNotification): string {
  const fallback = notification.gatheringId
    ? `/host/g/${notification.gatheringId}`
    : "/host/notifications";
  const raw = notification.deepLinkPath;
  if (!raw?.startsWith("/")) return fallback;

  try {
    const url = new URL(raw, "https://placeandplenty.local");
    const id = url.searchParams.get("id") || notification.gatheringId;
    if (!id) return fallback;

    const routeMap: Record<string, string> = {
      "/gathering/contributions": "contributions",
      "/gathering/people": "people",
      "/gathering/communication": "guest-experience",
      "/gathering/photos": "photos",
      "/gathering/shopping": "shopping",
      "/gathering/menu": "table",
      "/gathering/co-hosts": "co-hosts",
      "/gathering/music-media": "music",
      "/gathering/style-board": "style",
      "/gathering/find-help": "find-help",
      "/gathering/hub": "hub",
    };

    const child = routeMap[url.pathname];
    if (child) return `/host/g/${id}/${child}`;
    if (url.pathname === "/gathering/closet") return "/host/closet";
    if (url.pathname.startsWith("/gathering/")) return `/host/g/${id}`;
    return fallback;
  } catch {
    return fallback;
  }
}
