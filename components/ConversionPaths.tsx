import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import {
  availablePaths,
  PATH_NOTE,
  STORES_PENDING_NOTE,
  type ConversionPathId,
} from "@/lib/conversion";
import { hasAnyStoreLink } from "@/lib/app-links";

// THE FOUR CONVERSION PATHS, rendered.
//
// Start Free on Web | Buy on Web | Download for iPhone | Get it on
// Android — founder instruction, and a correction to a real problem:
// every call to action on this site used to end at the app, which made a
// browser-based product look like a brochure for a phone-based one.
//
// THE FIRST PATH IS VISUALLY PRIMARY AND THE REST ARE PEERS. Not because
// we prefer it, but because it is the only one that completes here,
// costs nothing, and requires no store account. Ranking by readiness is
// the honest ranking.
//
// PATH_NOTE IS NOT OPTIONAL COPY. Offering four doors immediately raises
// "does it matter which I use?", and the answer — one account, one
// entitlement, wherever you buy — is the founder's governing rule. A
// four-way choice without it reads as four different products.
//
// STORE PATHS ARE ABSENT UNTIL THE LISTINGS EXIST, and when they are
// absent the pending note appears in their place. See lib/conversion.ts.

const ICONS: Record<ConversionPathId, IconName> = {
  free: "laptop",
  buy: "card",
  ios: "phone",
  android: "phone",
};

export default function ConversionPaths({
  tone = "light",
  showNote = true,
  className = "",
}: {
  /** "dark" for the forest closing bands. */
  tone?: "light" | "dark";
  showNote?: boolean;
  className?: string;
}) {
  const paths = availablePaths();
  const dark = tone === "dark";

  const primary = dark
    ? "bg-offwhite text-forest hover:bg-cream"
    : "bg-forest text-offwhite hover:bg-forest/90";
  const secondary = dark
    ? "border border-offwhite/45 text-offwhite hover:bg-offwhite/10"
    : "border border-forest/35 text-forest hover:bg-forest/5";
  const detailText = dark ? "text-offwhite/65" : "text-forest/60";
  const noteText = dark ? "text-offwhite/70" : "text-forest/70";

  return (
    <div className={className}>
      <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
        {paths.map((path, i) => {
          const isPrimary = i === 0;
          const inner = (
            <>
              <span
                className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                  isPrimary
                    ? dark
                      ? "bg-forest/10 text-forest"
                      : "bg-offwhite/15 text-offwhite"
                    : dark
                      ? "bg-offwhite/10 text-offwhite"
                      : "bg-forest/5 text-forest"
                }`}
              >
                <Icon name={ICONS[path.id]} size={18} />
              </span>
              <span className="text-left">
                <span className="block font-body text-sm font-semibold leading-tight">
                  {path.label}
                </span>
                <span
                  className={`mt-0.5 block font-body text-xs leading-snug ${
                    isPrimary
                      ? dark
                        ? "text-forest/65"
                        : "text-offwhite/75"
                      : detailText
                  }`}
                >
                  {path.detail}
                </span>
              </span>
            </>
          );

          const classes = `flex h-full items-center gap-3 rounded-2xl px-5 py-3.5 transition-colors duration-400 ${
            isPrimary ? primary : secondary
          }`;

          return (
            <li key={path.id} className="sm:max-w-xs sm:flex-1">
              {path.external ? (
                <a
                  href={path.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={classes}
                >
                  {inner}
                </a>
              ) : (
                <Link href={path.href} className={classes}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {!hasAnyStoreLink() && (
        <p className={`mt-4 font-body text-xs leading-relaxed ${detailText}`}>
          {STORES_PENDING_NOTE}
        </p>
      )}

      {showNote && (
        <p
          className={`mt-4 max-w-xl font-body text-sm leading-relaxed ${noteText}`}
        >
          {PATH_NOTE}
        </p>
      )}
    </div>
  );
}
