import Link from "next/link";
import HostShell, { type HostNavGroup } from "@/components/host/HostShell";
import Icon from "@/components/Icon";
import { getUser } from "@/lib/supabase-server";
import {
  getProfile,
  getMyGatherings,
  getGuestBook,
  getClosetItems,
} from "@/lib/host-data";

// THE ACCOUNT-LEVEL SHELL, composed to `host_web_home.png`.
//
// §11 asks for "top account bar, gathering switcher, left-side
// navigation, large central workspace, responsive collapse". The
// reference draws exactly that: a forest sidebar carrying the wordmark
// and the account navigation, a slim top bar, and a wide cream
// workspace. §15 confirms the balance — "majority warm ivory/cream
// workspace, stronger forest/sage sidebar or navigation anchor".
//
// THE COUNTS ARE REAL. My Gatherings, My Guest Book and My Hosting
// Closet each show how many, read from the canonical tables. The
// reference shows 4 / 240 / 126 and the temptation is to render
// something that looks similar; a number nobody counted is worse than no
// number, so a count that cannot be read is simply omitted and the badge
// does not appear.
//
// GATHERING NAVIGATION IS NOT HERE. It belongs to the gathering
// workspace, because a rail of gathering tools on the gatherings LIST is
// navigation to nowhere.

export default async function AccountShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  // Failing to read a count costs a badge, not the page.
  const [profile, gatherings, guestBook, closet] = await Promise.all([
    getProfile(),
    getMyGatherings().catch(() => null),
    getGuestBook().catch(() => null),
    getClosetItems().catch(() => null),
  ]);

  const name =
    profile?.display_name || profile?.first_name || user?.email || "Your account";

  const activeCount = gatherings
    ? gatherings.filter((g) => ["draft", "active", "hosting"].includes(g.status))
        .length
    : null;

  const groups: HostNavGroup[] = [
    {
      items: [
        { label: "Home", href: "/host", icon: "house", exact: true },
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
          count: guestBook?.length ?? null,
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
      title="My Host Hub"
      topBar={
        <>
          {typeof activeCount === "number" && activeCount > 0 && (
            <span className="hidden items-center gap-2 rounded-lg bg-cream px-3 py-2 font-body text-sm text-forest/80 md:flex">
              <Icon name="calendar" size={16} />
              {activeCount} active
            </span>
          )}

          <Link
            href="/host/account"
            className="hidden max-w-[12rem] items-center gap-2 truncate rounded-lg border border-sage/40 px-3 py-2 font-body text-sm text-forest transition-colors duration-400 hover:bg-forest/5 sm:flex"
          >
            <Icon name="users" size={17} className="flex-shrink-0" />
            <span className="truncate">{name}</span>
          </Link>

          {/* POST, not a link — see app/auth/signout/route.ts. */}
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
