"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import CtaButton from "@/components/CtaButton";
import { PRIMARY_NAV, SECONDARY_NAV, ACCOUNT_NAV } from "@/lib/nav";

// WHY THIS IS A CLIENT COMPONENT NOW.
//
// The previous header put the whole nav behind `hidden md:flex` with no
// alternative, so on a phone the site had NO navigation at all — just a
// logo and a CTA. Every destination below the fold was unreachable except
// through the footer. Directive §27 asks for intentional phone/tablet/
// desktop behaviour; this was the largest gap.
//
// The disclosure is deliberately plain: a button that toggles a panel,
// aria-expanded/aria-controls wired up, Escape to close, focus returned
// to the trigger, and route changes close it. No focus trap, because the
// panel is in the document flow and pushes content down rather than
// covering it — a trap would make the rest of the page unreachable for a
// keyboard user without adding safety.

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
    <header className="sticky top-0 z-50 border-b border-sage/30 bg-offwhite/90 backdrop-blur">
      <div className="mx-auto flex max-w-editorial items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex flex-shrink-0 items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-forest"
        >
          <Image
            src="/images/pp-mark.png"
            alt="Place & Plenty"
            width={36}
            height={36}
            className="rounded-md"
            priority
          />
          <span>Place &amp; Plenty</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 font-body text-sm text-forest/80 lg:flex"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="transition-colors duration-400 hover:text-forest aria-[current=page]:text-forest aria-[current=page]:underline aria-[current=page]:decoration-gold aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden font-body text-sm text-forest/80 transition-colors duration-400 hover:text-forest sm:block"
          >
            Log in
          </Link>
          <div className="hidden sm:block">
            <CtaButton size="sm" />
          </div>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-forest transition-colors duration-400 hover:bg-forest/5 lg:hidden"
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
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
        className="border-t border-sage/30 bg-offwhite lg:hidden"
      >
        <nav
          aria-label="All pages"
          className="mx-auto max-w-editorial px-6 py-5"
        >
          <ul className="flex flex-col">
            {[...PRIMARY_NAV, ...SECONDARY_NAV, ...ACCOUNT_NAV].map((item) => (
              <li key={item.href} className="border-b border-sage/15 last:border-0">
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
          <div className="mt-5 sm:hidden">
            <CtaButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
