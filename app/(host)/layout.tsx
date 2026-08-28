import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase-server";
import { getProfile } from "@/lib/host-data";

// THE HOST WEB APP SHELL — the third chrome, alongside (marketing) and
// (guest). §11: "top account bar, gathering switcher, left-side
// gathering navigation, large central workspace, responsive collapse".
//
// This layout owns the account bar. The gathering navigation lives one
// level down in (host)/host/g/[id]/layout.tsx, because it only exists
// once a gathering is chosen — a left rail of gathering tools on the
// gatherings LIST would be navigation to nowhere.
//
// §25: "Do not merely stretch mobile cards across a desktop browser" and
// "do not let the host web experience become an enterprise admin
// dashboard". So: the Place & Plenty palette and serif display type
// throughout, generous space, no dense data grid, no sidebar of icons.
// It should read as the same product as the marketing site, doing a
// different job.
//
// THE MIDDLEWARE ALREADY GATES /host. The getUser() call below is a
// second check, and it is not redundant: middleware can be bypassed if
// the matcher is ever edited carelessly, and this layout is the thing
// that actually renders host data. A gate at the render boundary is the
// one that cannot be routed around.

export const metadata = {
  title: "My Gatherings",
  robots: { index: false, follow: false },
};

// Host pages read per-request session data, so they are never static.
export const dynamic = "force-dynamic";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login?next=/host");

  const profile = await getProfile();
  const name =
    profile?.display_name || profile?.first_name || user.email || "Your account";

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <a
        href="#host-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite"
      >
        Skip to content
      </a>

      <header className="border-b border-sage/30 bg-forest text-offwhite">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/host"
              className="flex items-center gap-2.5 font-display text-lg font-semibold tracking-tight"
            >
              <Image
                src="/images/pp-mark.png"
                alt=""
                aria-hidden
                width={28}
                height={28}
                className="rounded"
              />
              <span>Place &amp; Plenty</span>
            </Link>

            <nav
              aria-label="Account"
              className="hidden items-center gap-5 font-body text-sm text-offwhite/80 sm:flex"
            >
              <Link
                href="/host"
                className="transition-colors duration-400 hover:text-offwhite"
              >
                My Gatherings
              </Link>
              <Link
                href="/host/guest-book"
                className="transition-colors duration-400 hover:text-offwhite"
              >
                My Guest Book
              </Link>
              <Link
                href="/host/closet"
                className="transition-colors duration-400 hover:text-offwhite"
              >
                My Hosting Closet
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4 font-body text-sm">
            <Link
              href="/host/account"
              className="max-w-[14rem] truncate text-offwhite/85 underline decoration-gold underline-offset-4 transition-colors duration-400 hover:text-offwhite"
            >
              {name}
            </Link>
            {/* POST, not a link — see app/auth/signout/route.ts. */}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-offwhite/40 px-4 py-1.5 font-semibold text-offwhite/90 transition-colors duration-400 hover:bg-offwhite/10"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        {/* Account nav collapses to its own row rather than disappearing,
            so a phone still reaches the Guest Book and the Closet. */}
        <nav
          aria-label="Account, condensed"
          className="border-t border-offwhite/15 px-6 py-2 sm:hidden"
        >
          <ul className="flex gap-5 font-body text-sm text-offwhite/80">
            <li>
              <Link href="/host">Gatherings</Link>
            </li>
            <li>
              <Link href="/host/guest-book">Guest Book</Link>
            </li>
            <li>
              <Link href="/host/closet">Closet</Link>
            </li>
          </ul>
        </nav>
      </header>

      <main id="host-main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-sage/25 py-6">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-3 px-6 font-body text-xs text-forest/55">
          <p>Home Hosting. Made Simple.</p>
          <div className="flex gap-4">
            <Link href="/support" className="hover:text-forest">
              Support
            </Link>
            <Link href="/privacy" className="hover:text-forest">
              Privacy
            </Link>
            <Link href="/" className="hover:text-forest">
              Main site
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
