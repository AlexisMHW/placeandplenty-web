import Link from "next/link";
import { getHostNotifications, resolveNotificationWebPath } from "@/lib/notification-data";
import NotificationRow from "@/components/host/NotificationRow";
import { WorkspaceHeader, EmptyState } from "@/components/host/Workspace";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: { id?: string };
}) {
  const gatheringId = typeof searchParams?.id === "string" ? searchParams.id : undefined;
  const notifications = await getHostNotifications(gatheringId);
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="mx-auto max-w-[70rem] px-6 py-10 md:py-14">
      <WorkspaceHeader
        title={gatheringId ? "Gathering Notifications" : "Notifications"}
        description={
          gatheringId
            ? "Updates connected to this gathering."
            : "Updates from the gatherings you host, all in one place."
        }
      />

      {gatheringId && (
        <Link
          href="/host/notifications"
          className="mt-4 inline-block font-body text-sm font-semibold text-forest/70 underline decoration-gold decoration-2 underline-offset-4"
        >
          View all notifications
        </Link>
      )}

      {notifications.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing needs your attention."
            body={
              gatheringId
                ? "There are no notifications for this gathering yet."
                : "When something changes in one of your gatherings, it will appear here."
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <p className="font-body text-sm text-forest/65">
              {notifications.length} {notifications.length === 1 ? "notification" : "notifications"}
            </p>
            {unread > 0 && (
              <span className="rounded-full bg-forest px-3 py-1 font-body text-xs font-semibold text-offwhite">
                {unread} unread
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                href={resolveNotificationWebPath(notification)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
