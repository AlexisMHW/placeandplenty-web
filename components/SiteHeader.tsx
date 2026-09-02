"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { PRIMARY_PATH } from "@/lib/conversion";
import { getBrowserClient } from "@/lib/supabase-browser";

const DESKTOP_NAV = [
  ...PRIMARY_NAV,
  SECONDARY_NAV.find((item) => item.href === "/show-us-how-you-gather")!,
  SECONDARY_NAV.find((item) => item.href === "/about")!,
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    const supabase = getBrowserClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(!!data.user);
      setAuthResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setSignedIn(!!session?.user);
      setAuthResolved(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-sage/25 bg-offwhite/95 backdrop-blur">
      <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="flex-shrink-0" aria-label="Place & Plenty, home">
          <Wordmark />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-4 font-body text-[0.8rem] text-forest/80 xl:flex"
        >
          {DESKTOP_NAV.map((item) => (
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

        <div className="flex flex-shrink-0 items-center gap-2">
          {authResolved && signedIn ? (
            <Link
              href="/host"
              className="hidden rounded-lg bg-forest px-4 py-2 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 sm:block"
            >
              My Gatherings
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg border border-forest/30 px-3.5 py-2 font-body text-sm text-forest transition-colors duration-400 hover:bg-forest/5 sm:block"
              >
                Log In
              </Link>
              <Link
                href={PRIMARY_PATH.href}
                className="hidden rounded-lg bg-forest px-3.5 py-2 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 sm:block"
              >
                Start Free
              </Link>
            </>
          )}

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
            {authResolved && signedIn ? (
              <Link
                href="/host"
                className="rounded-lg bg-forest px-4 py-3 text-center font-body text-sm font-semibold text-offwhite"
              >
                My Gatherings
              </Link>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
