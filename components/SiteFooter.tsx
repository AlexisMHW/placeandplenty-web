import Link from "next/link";
import Image from "next/image";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  UTILITY_NAV,
  ACCOUNT_NAV,
  SOCIAL_LINKS,
} from "@/lib/nav";
import { BRAND_NAME, PROMISE, TAGLINE } from "@/lib/brand";

// Grouped rather than one flat list, so "Delete Account" no longer sits
// between "Privacy" and "Terms" in the same run as "Features" — a legal
// obligation and a marketing page reading as peers.

const columns = [
  { heading: "Explore", items: PRIMARY_NAV },
  { heading: "More", items: SECONDARY_NAV },
  { heading: "Legal", items: UTILITY_NAV },
  { heading: "Account", items: ACCOUNT_NAV },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-sage/30 bg-forest py-14 text-offwhite">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="md:max-w-xs">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/pp-mark.png"
                alt=""
                aria-hidden
                width={28}
                height={28}
                className="rounded-md"
              />
              <p className="font-display text-2xl">{BRAND_NAME}</p>
            </div>
            <p className="mt-1 font-body text-sm text-offwhite/70">
              {TAGLINE}
            </p>
            <p className="mt-4 font-body text-sm leading-relaxed text-offwhite/60">
              {PROMISE}
            </p>
            <p className="mt-4 font-body text-xs uppercase tracking-wide text-offwhite/50">
              placeandplenty.com
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-offwhite/50">
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

        <div className="mt-12 flex flex-col gap-4 border-t border-offwhite/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-offwhite/50">
            © {new Date().getFullYear()} {BRAND_NAME}. All rights
            reserved.
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
      </div>
    </footer>
  );
}
