import Image from "next/image";
import QrCode from "@/components/QrCode";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  APP_DOWNLOAD_URL,
  STORE_BADGES,
  hasAnyStoreLink,
} from "@/lib/app-links";

// The app-download area. Store buttons lead; the QR is secondary and sits
// inside the same panel rather than in a block of its own.
//
// THE GATE IS THE POINT. Founder instruction: no placeholder or dead
// store links. Until lib/app-links.ts holds real URLs this renders the
// panel with its explanation and NO actions — the layout is real and
// tested, the buttons simply are not there to be tapped. Nothing here
// needs editing when the links land.
//
// The QR is hidden below `sm`, because a code shown on the phone you
// would be scanning it with is useless — on that screen the store buttons
// already do the job. It is not `hidden` in the accessibility sense
// either way: QrCode is aria-hidden, and the same destination is always
// reachable as a real link beneath it.

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
        <Image src={badge} alt={badgeAlt} width={168} height={50} />
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

          {live && (
            <div className="hidden flex-shrink-0 sm:block">
              <div className="rounded-card border border-offwhite/20 bg-offwhite/5 p-5 text-center">
                <div className="rounded-md bg-offwhite p-2.5">
                  <QrCode value={APP_DOWNLOAD_URL} size={132} />
                </div>
                <p className="mt-3 max-w-[9.5rem] font-body text-xs leading-relaxed text-offwhite/75">
                  Scan to download Place &amp; Plenty
                </p>
                {/* The QR is aria-hidden and useless to anyone who cannot
                    point a camera at it, so its destination is also a
                    plain link. */}
                <a
                  href={APP_DOWNLOAD_URL}
                  className="mt-2 inline-block font-body text-xs underline decoration-gold underline-offset-4 text-offwhite/70 transition-colors duration-400 hover:text-offwhite"
                >
                  Or open the download page
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
