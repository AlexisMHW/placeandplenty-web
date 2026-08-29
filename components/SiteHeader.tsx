"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { PRIMARY_PATH } from "@/lib/conversion";

// THE MASTHEAD, composed to the references.
//
// All eight public references share it exactly: the two-line P & P
// wordmark on the left, the page nav centred, and on the right an
// outlined "Log In" beside a filled forest action. The active page is
// underlined in gold. Nothing floats, nothing is translucent, and the
// only rule is a hairline along the bottom.
//
// THE RIGHT-HAND ACTION IS NOW "START FREE", NOT "GET THE APP". The
// references say Get the App because they were drawn when the app was
// the only surface; the founder's V1 requirement is that a person can
// create an account and use Place & Plenty entirely on the web, so the
// masthead's single action is the one that does that. It resolves
// through lib/conversion.ts, which is also what fills the four-path
// blocks lower down every page — one definition, so the header can never
// promise something the closing band does not offer.
//
// WHY THIS IS A CLIENT COMPONENT. The mobile disclosure. Before it, the
// whole nav sat behind `lg:` with no alternative, so on a phone the site
// had NO navigation at all — every destination below the fold was
// unreachable except through the footer. It is deliberately plain: a
// button toggling a panel, aria-expanded/aria-controls wired up, Escape
// to close, focus returned to the trigger, route changes close it. No
// focus trap, because the panel pushes content down rather than covering
// it and a trap would make the rest of the page unreachable by keyboard
// without adding any safety.

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A tap on a nav link navigates but does not unmount the header, so the
  // panel would otherwise stay open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-sage/25 bg-offwhite/95 backdrop-blur">
      <div className="mx-auto flex max-w-[82rem] items-center justify-between gap-6 px-6 py-3.5">
        <Link href="/" className="flex-shrink-0" aria-label="Place & Plenty, home">
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 font-body text-[0.9rem] text-forest/80 xl:flex"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="whitespace-nowrap pb-1 transition-colors duration-400 hover:text-forest aria-[current=page]:border-b-2 aria-[current=page]:border-gold aria-[current=page]:text-forest"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-lg border border-forest/30 px-4 py-2 font-body text-sm text-forest transition-colors duration-400 hover:bg-forest/5 sm:block"
          >
            Log In
          </Link>
          <Link
            href={PRIMARY_PATH.href}
            className="hidden rounded-lg bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 sm:block"
          >
            Start Free
          </Link>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors duration-400 hover:bg-forest/5 xl:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
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
        </div>
      </div>

      <div
        id="site-menu"
        hidden={!open}
        className="border-t border-sage/25 bg-offwhite xl:hidden"
      >
        <nav aria-label="All pages" className="mx-auto max-w-editorial px-6 py-5">
          <ul className="flex flex-col">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
              <li key={item.href} className="border-b border-sage/15">
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="block py-3.5 font-body text-base text-forest/85 transition-colors duration-400 hover:text-forest aria-[current=page]:font-semibold aria-[current=page]:text-forest"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-3 sm:hidden">
            <Link
              href={PRIMARY_PATH.href}
              className="rounded-lg bg-forest px-4 py-3 text-center font-body text-sm font-semibold text-offwhite"
            >
              Start Free
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-forest/30 px-4 py-3 text-center font-body text-sm text-forest"
            >
              Log In
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
