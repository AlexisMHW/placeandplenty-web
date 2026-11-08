import Image from "next/image";
import PlatformQrCodes from "@/components/PlatformQrCodes";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  STORE_BADGES,
  hasAnyStoreLink,
} from "@/lib/app-links";

// Store buttons and labeled platform codes share verified store destinations.

function StoreButton({
  href,
  badge,
  badgeAlt,
  label,
  sublabel,
}: {
  href: string;
  badge: string | null;
  badgeAlt: string;
  label: string;
  sublabel: string;
}) {
  if (badge) {
    return (
      <a href={href} className="inline-block rounded-lg">
        {/* Official vendor artwork carries its own wordmark, so the alt
            text is the badge's own text and nothing is added around it. */}
        <Image src={badge} alt={badgeAlt} width={120} height={40} unoptimized={badge.startsWith("https://")} className="h-12 w-auto" />
      </a>
    );
  }

  // No official badge file present. A text button in our own visual
  // language is preferable to an approximation of Apple's or Google's
  // trademarked artwork — see the note in lib/app-links.ts.
  return (
    <a
      href={href}
      className="inline-flex min-w-[10.5rem] items-center gap-3 rounded-lg border border-offwhite/30 bg-offwhite/10 px-4 py-2.5 transition-colors duration-400 hover:bg-offwhite/20"
    >
      <span className="font-body text-left leading-tight text-offwhite">
        <span className="block text-[0.65rem] uppercase tracking-wide text-offwhite/70">
          {sublabel}
        </span>
        <span className="block text-sm font-semibold">{label}</span>
      </span>
    </a>
  );
}

export default function AppDownload() {
  const live = hasAnyStoreLink();

  return (
    <section className="bg-forest py-16 text-offwhite md:py-20">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-12">
          <div className="max-w-xl">
            <span aria-hidden className="mb-4 block h-px w-8 bg-gold" />
            <h2 className="font-display text-2xl leading-tight md:text-3xl">
              Get Place &amp; Plenty on your phone.
            </h2>
            <p className="mt-3 font-body text-base leading-relaxed text-offwhite/80">
              {live
                ? "Plan on the couch, shop from the aisle, and check what's left on the way home."
                : "The apps arrive with the app release. Until then, and after it, the whole of Place & Plenty works in your browser — same account, same gatherings."}
            </p>

            {live && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {APP_STORE_URL && (
                  <StoreButton
                    href={APP_STORE_URL}
                    badge={STORE_BADGES.apple}
                    badgeAlt="Download on the App Store"
                    sublabel="Download on the"
                    label="App Store"
                  />
                )}
                {PLAY_STORE_URL && (
                  <StoreButton
                    href={PLAY_STORE_URL}
                    badge={STORE_BADGES.google}
                    badgeAlt="Get it on Google Play"
                    sublabel="Get it on"
                    label="Google Play"
                  />
                )}
              </div>
            )}
          </div>

          {live && <PlatformQrCodes className="w-full max-w-sm flex-shrink-0" />}
        </div>
      </div>
    </section>
  );
}
