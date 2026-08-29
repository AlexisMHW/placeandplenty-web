import Link from "next/link";
import { BotanicalBough } from "@/components/Botanical";
import Icon, { type IconName } from "@/components/Icon";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  UTILITY_NAV,
  ACCOUNT_NAV,
  SOCIAL_LINKS,
} from "@/lib/nav";
import Wordmark from "@/components/Wordmark";
import { BRAND_NAME, TAGLINE } from "@/lib/brand";

// THE FOOTER, composed to the references.
//
// Every reference shows the same closing structure and it is a link
// footer, not a second sales pitch: the monogram with the tagline under
// it on the left, three or four short link columns, the social row, a
// botanical bough in the outer corner, and a thin rule above the
// copyright line.
//
// WHY THE CTA CAME OUT OF HERE. The home page reference puts a "Ready to
// host with ease?" block inside the footer; every other reference puts
// it in a band ABOVE the footer instead. The band won, because with
// CtaBand now closing every page (see components/CtaBand.tsx) a footer
// CTA would be the second call to action in the same screenful — which
// reads as pleading rather than as confidence, and §18 is explicit that
// the posture is "we have been here doing the work".
//
// WHAT THE REFERENCES SHOW THAT IS DELIBERATELY NOT COPIED. Careers,
// Press, Help Center, Contact Us. None of those routes exist, and §7 and
// §18 forbid placeholders — a footer column linking to nothing is the
// clearest possible signal that a site is a mock-up. The columns below
// list what is actually there.
//
// Links come from lib/nav.ts, so a new page reaches the header, the
// footer and the sitemap by construction rather than by memory.

const COLUMNS = [
  { heading: "Explore", items: PRIMARY_NAV },
  { heading: "Company", items: SECONDARY_NAV },
  { heading: "Support", items: [...UTILITY_NAV, ...ACCOUNT_NAV] },
];

// The social row uses the house line set rather than brand glyphs. Each
// platform's real logo is trademarked artwork with its own presentation
// rules, and an approximation drawn by hand is the kind of thing that is
// both legally sloppy and visually obvious. The accessible name carries
// the platform; the icon carries the medium.
const SOCIAL_ICONS: Record<string, IconName> = {
  Instagram: "camera",
  Facebook: "chat",
  TikTok: "music",
  YouTube: "photo",
};

export default function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-forest text-offwhite">
      <BotanicalBough
        className="pointer-events-none absolute -right-10 bottom-0 hidden text-gold/20 lg:block"
        width={260}
        flip
      />

      <div className="relative mx-auto max-w-editorial px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] lg:gap-20">
          {/* ---- brand block ---------------------------------------- */}
          <div>
            {/* ONE MARK, NOT TWO. This carried the PNG badge AND the
                typographic "P & P" side by side, which read as the logo
                printed twice. The masthead's Wordmark is the lockup — the
                monogram with the sprig in the ampersand and the name
                beneath it — so the footer uses the same one. */}
            <Link href="/" className="inline-block" aria-label="Place & Plenty, home">
              <Wordmark tone="offwhite" />
            </Link>
            <p className="mt-5 font-body text-sm text-offwhite/75">{TAGLINE}</p>
          </div>

          {/* ---- link columns --------------------------------------- */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
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

            <div>
              <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
                Connect
              </h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-offwhite/25 text-offwhite/80 transition-colors duration-400 hover:border-gold hover:text-offwhite"
                    >
                      <span className="sr-only">{s.label}</span>
                      <Icon name={SOCIAL_ICONS[s.label] || "heart"} size={17} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-offwhite/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-offwhite/50">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
          </p>
          <p className="font-body text-xs text-offwhite/50">
            One account on the web and in the app.
          </p>
        </div>
      </div>
    </footer>
  );
}
