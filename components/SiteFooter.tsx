import Link from "next/link";
import Image from "next/image";
import CtaButton from "@/components/CtaButton";
import { Display } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  UTILITY_NAV,
  ACCOUNT_NAV,
  SOCIAL_LINKS,
} from "@/lib/nav";
import { BRAND_NAME, PROMISE, TAGLINE } from "@/lib/brand";
import { hasAnyStoreLink } from "@/lib/app-links";

// The footer, composed to the reference: a closing CTA on the left, the
// app download in the middle, link columns on the right, then a rule
// above the wordmark and copyright.
//
// TWO THINGS THE REFERENCE SHOWS THAT ARE NOT COPIED, both for the same
// reason — §7 and §18 forbid placeholders and dead links:
//
//   Careers / Press / Help Center / Contact Us — none of these routes
//   exist. A footer column linking to nothing is the clearest possible
//   signal that a site is a mock-up. Ours lists what is actually there.
//
//   App Store and Google Play badges — the listings do not exist. The
//   download block keeps the reference's position and shape and says
//   what is true; the badges appear by themselves the moment
//   lib/app-links.ts holds real URLs.
//
// Link columns come from lib/nav.ts, so a new page reaches the header,
// the footer and the sitemap by construction rather than by memory.

const columns = [
  { heading: "Explore", items: PRIMARY_NAV },
  { heading: "More", items: SECONDARY_NAV },
  { heading: "Legal", items: [...UTILITY_NAV, ...ACCOUNT_NAV] },
];

export default function SiteFooter() {
  const storesLive = hasAnyStoreLink();

  return (
    <footer className="relative overflow-hidden bg-forest text-offwhite">
      <BotanicalSprig
        className="pointer-events-none absolute -right-6 bottom-0 hidden text-offwhite/10 lg:block"
        size={210}
      />

      <div className="relative mx-auto max-w-editorial px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
          <div>
            <Display
              emphasis="ease"
              className="text-3xl leading-tight md:text-4xl"
            >
              Ready to host with ease?
            </Display>
            <p className="mt-3 font-body text-sm text-gold">
              Plan your next gathering in minutes.
            </p>
            <div className="mt-6">
              <CtaButton onDark size="sm" />
            </div>
          </div>

          <div>
            <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-offwhite/55">
              The app
            </h2>
            <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-offwhite/80">
              {storesLive
                ? "Your guests, lists and updates — right in your pocket."
                : "Place & Plenty is built for the phone in your pocket. Join the Guest List and you’ll hear the moment the apps go live."}
            </p>
            <Link
              href="/get"
              className="mt-4 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-xs font-semibold uppercase tracking-[0.14em] text-offwhite transition-colors duration-400 hover:text-gold"
            >
              {storesLive ? "Get the app" : "About the app"}
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-offwhite/55">
                  {column.heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="font-body text-sm text-offwhite/80 transition-colors duration-400 hover:text-offwhite"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-offwhite/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/pp-mark.png"
              alt=""
              aria-hidden
              width={28}
              height={28}
              className="rounded-md"
            />
            <div>
              <p className="font-display text-lg leading-none">{BRAND_NAME}</p>
              <p className="mt-1 font-body text-xs text-offwhite/60">
                {TAGLINE}
              </p>
            </div>
          </div>

          <p className="max-w-sm font-body text-xs leading-relaxed text-offwhite/50">
            {PROMISE}
          </p>

          <div className="flex flex-wrap gap-5 font-body text-xs text-offwhite/70">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-400 hover:text-offwhite"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <p className="mt-8 font-body text-xs text-offwhite/45">
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
