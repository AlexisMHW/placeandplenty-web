"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Wordmark from "@/components/Wordmark";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";
import { RALLY, TAGLINE } from "@/lib/brand";

// THE HOST WEB SHELL, composed to `host_web_home.png` and
// `host_web_gathering.png`.
//
// Both references show the same architecture and it is not the top-bar
// layout this app had before:
//
//   left    a full-height sidebar carrying the wordmark, the navigation
//           with icons and counts, and an app-promo card pinned at the
//           bottom
//   top     a slim bar with the surface title, a gathering switcher, one
//           or two actions, and the account control on the right
//   centre  a wide, warm workspace on the cream ground
//
// THE COLOUR SPLIT IS THE REFERENCES' AND §15 CONFIRMS IT. The account
// sidebar is deep forest; the gathering sidebar is pale. That is not an
// inconsistency in the mockups — it is a useful signal that you have
// gone one level in, and §15 asks for exactly this balance: "majority
// warm ivory/cream workspace, stronger forest/sage sidebar or navigation
// anchor, selective green active states". §16 repeats it for the
// gathering view and rules out both an all-white dashboard and a wall of
// dark green.
//
// WHY THE NAV IS PASSED IN RATHER THAN BUILT HERE. The account level and
// the gathering level have different navigation and the same furniture.
// One shell, two nav sets, so the chrome cannot drift between them.
//
// RESPONSIVE: below `lg` the sidebar becomes a disclosure panel above
// the workspace rather than vanishing. §25 warns against stretching
// mobile cards across a desktop; the inverse — a desktop sidebar that
// simply disappears on a phone — is the same failure pointing the other
// way, and it is what happens to most admin layouts.

export interface HostNavItem {
  label: string;
  href: string;
  icon: IconName;
  /** A live count, where one is genuinely known. Never a placeholder. */
  count?: number | null;
  exact?: boolean;
}

export interface HostNavGroup {
  heading?: string;
  items: HostNavItem[];
}

export default function HostShell({
  tone = "forest",
  groups,
  title,
  backHref,
  backLabel,
  topBar,
  children,
}: {
  tone?: "forest" | "light";
  groups: HostNavGroup[];
  title: string;
  backHref?: string;
  backLabel?: string;
  /** The right-hand side of the top bar — actions and the account control. */
  topBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dark = tone === "forest";

  const sidebar = dark
    ? "bg-forest text-offwhite"
    : "bg-parchment text-forest border-r border-sage/30";
  const itemIdle = dark
    ? "text-offwhite/80 hover:bg-offwhite/10 hover:text-offwhite"
    : "text-forest/80 hover:bg-forest/5 hover:text-forest";
  const itemActive = dark
    ? "bg-offwhite/15 text-offwhite font-semibold"
    : "bg-sage/25 text-forest font-semibold";
  const headingTone = dark ? "text-gold" : "text-forest/55";

  const isCurrent = (item: HostNavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const nav = (
    <nav aria-label="Host" className="flex flex-col gap-6">
      {groups.map((group, gi) => (
        <div key={group.heading ?? gi}>
          {group.heading && (
            <h2
              className={`px-3 font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] ${headingTone}`}
            >
              {group.heading}
            </h2>
          )}
          <ul className={group.heading ? "mt-2.5 space-y-1" : "space-y-1"}>
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isCurrent(item) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-body text-sm transition-colors duration-400 ${
                    isCurrent(item) ? itemActive : itemIdle
                  }`}
                >
                  <Icon name={item.icon} size={19} className="flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {typeof item.count === "number" && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-body text-[0.65rem] font-semibold ${
                        dark
                          ? "bg-offwhite/15 text-offwhite/90"
                          : "bg-forest/10 text-forest/80"
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const promo = (
    <div
      className={`relative overflow-hidden rounded-xl p-4 ${
        dark ? "bg-offwhite/10" : "bg-cream"
      }`}
    >
      <BotanicalSprig
        className={`pointer-events-none absolute -right-2 -top-1 ${
          dark ? "text-offwhite/20" : "text-olive/35"
        }`}
        size={64}
      />
      <p
        className={`relative font-display text-base leading-snug ${
          dark ? "text-offwhite" : "text-forest"
        }`}
      >
        {RALLY.split(" ").slice(0, 2).join(" ")}
        <br />
        <em className="italic">{RALLY.split(" ").slice(2).join(" ")}</em>
      </p>
      <Link
        href="/get"
        className={`relative mt-3 inline-block font-body text-xs font-semibold underline decoration-gold decoration-2 underline-offset-4 ${
          dark ? "text-offwhite/90" : "text-forest/85"
        }`}
      >
        Take it with you <span aria-hidden>&rarr;</span>
      </Link>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-offwhite">
      {/* The skip link belongs to the shell, not to a page: the sidebar
          is a long list of links a keyboard user would otherwise have to
          walk through on every navigation. */}
      <a
        href="#host-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite"
      >
        Skip to content
      </a>

      {/* ---- sidebar, desktop --------------------------------------- */}
      <aside
        className={`hidden w-64 flex-shrink-0 flex-col justify-between p-5 lg:flex ${sidebar}`}
      >
        <div>
          <Link href="/host" className="block px-3">
            <Wordmark tone={dark ? "offwhite" : "forest"} />
          </Link>
          <p
            className={`mt-3 px-3 font-body text-[0.68rem] ${
              dark ? "text-offwhite/55" : "text-forest/55"
            }`}
          >
            {TAGLINE}
          </p>

          <div className="mt-7">{nav}</div>
        </div>

        <div className="mt-8">{promo}</div>
      </aside>

      {/* ---- workspace ----------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-sage/25 bg-offwhite/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="host-menu"
                className="-ml-2 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-forest hover:bg-forest/5 lg:hidden"
              >
                <span className="sr-only">
                  {open ? "Close menu" : "Open menu"}
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  {open ? (
                    <>
                      <path d="M5 5l14 14" />
                      <path d="M19 5L5 19" />
                    </>
                  ) : (
                    <>
                      <path d="M3.5 7h17" />
                      <path d="M3.5 12h17" />
                      <path d="M3.5 17h17" />
                    </>
                  )}
                </svg>
              </button>

              <div className="min-w-0">
                {backHref && (
                  <Link
                    href={backHref}
                    className="block truncate font-body text-[0.68rem] text-forest/55 transition-colors duration-400 hover:text-forest"
                  >
                    <span aria-hidden>&larr;</span> {backLabel}
                  </Link>
                )}
                <p className="truncate font-display text-lg leading-tight text-forest">
                  {title}
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2.5">
              {topBar}
            </div>
          </div>

          {/* the sidebar's contents, on a phone */}
          <div
            id="host-menu"
            hidden={!open}
            className="border-t border-sage/25 bg-parchment px-5 py-5 lg:hidden"
          >
            {nav}
            <div className="mt-6">{promo}</div>
          </div>
        </header>

        <main id="host-main" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-sage/25 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 font-body text-xs text-forest/55">
            <p>{TAGLINE}</p>
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
    </div>
  );
}
