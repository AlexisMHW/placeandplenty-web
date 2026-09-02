import Link from "next/link";
import HostShell, { type HostNavGroup } from "@/components/host/HostShell";
import EditableHostName from "@/components/host/EditableHostName";
import Icon from "@/components/Icon";
import { getUser } from "@/lib/supabase-server";
import {
  getProfile,
  getMyGatherings,
  getGuestBook,
  getClosetItems,
} from "@/lib/host-data";

export default async function AccountShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  const [profile, gatherings, guestBook, closet] = await Promise.all([
    getProfile(),
    getMyGatherings().catch(() => null),
    getGuestBook().catch(() => null),
    getClosetItems().catch(() => null),
  ]);

  const name =
    profile?.display_name || profile?.first_name || user?.email || "Your account";

  const openCount = gatherings
    ? gatherings.filter((g) =>
        ["draft", "active", "hosting"].includes(g.effective_status)
      ).length
    : null;

  const groups: HostNavGroup[] = [
    {
      items: [
        { label: "Home", href: "/host", icon: "house", exact: true },
        { label: "Create Gathering", href: "/host/create", icon: "calendar" },
        {
          label: "My Hosting Closet",
          href: "/host/closet",
          icon: "closet",
          count: closet?.length ?? null,
        },
        {
          label: "My Guest Book",
          href: "/host/guest-book",
          icon: "book",
          count: guestBook?.saved.length ?? null,
        },
      ],
    },
    {
      heading: "Find & plan",
      items: [
        { label: "Gathering Ideas", href: "/gathering-ideas", icon: "sparkle" },
        {
          label: "The Coordinated Host",
          href: "/coordinated-host",
          icon: "leaf",
        },
      ],
    },
    {
      heading: "Account",
      items: [
        { label: "My Account", href: "/host/account", icon: "settings" },
        { label: "Support", href: "/support", icon: "search" },
      ],
    },
  ];

  return (
    <HostShell
      tone="forest"
      groups={groups}
      title="My Gatherings"
      topBar={
        <>
          {typeof openCount === "number" && openCount > 0 && (
            <span className="hidden items-center gap-2 rounded-lg bg-cream px-3 py-2 font-body text-sm text-forest/80 md:flex">
              <Icon name="calendar" size={16} />
              {openCount} open
            </span>
          )}

          <Link
            href="/host/create"
            className="hidden rounded-lg bg-forest px-3.5 py-2 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 sm:inline-flex"
          >
            Create Gathering
          </Link>

          <EditableHostName name={String(name)} />

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-sage/40 px-3.5 py-2 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
            >
              Log out
            </button>
          </form>
        </>
      }
    >
      {children}
    </HostShell>
  );
}
