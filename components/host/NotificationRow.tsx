"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markHostNotificationRead } from "@/lib/notification-actions";
import type { HostNotification } from "@/lib/notification-data";

export default function NotificationRow({
  notification,
  href,
}: {
  notification: HostNotification;
  href: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      if (!notification.readAt) {
        try {
          await markHostNotificationRead(notification.id);
        } catch {
          // Navigation still proceeds. A read marker should never strand
          // someone away from the thing the notification is about.
        }
      }
      router.push(href);
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-px hover:shadow-softer disabled:opacity-60 ${
        notification.readAt
          ? "border-sage/20 bg-offwhite"
          : "border-gold/35 bg-cream"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full ${
            notification.readAt ? "bg-sage/30" : "bg-forest"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-semibold text-forest">
            {notification.title}
          </p>
          {notification.body && (
            <p className="mt-1 font-body text-sm leading-relaxed text-forest/65">
              {notification.body}
            </p>
          )}
          <p className="mt-2 font-body text-xs text-forest/45">
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }).format(new Date(notification.createdAt))}
          </p>
        </div>
      </div>
    </button>
  );
}
