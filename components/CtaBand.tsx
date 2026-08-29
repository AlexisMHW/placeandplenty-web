import { Display } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";
import ConversionPaths from "@/components/ConversionPaths";
import QrCode from "@/components/QrCode";
import { APP_DOWNLOAD_URL, hasAnyStoreLink } from "@/lib/app-links";
import { RALLY } from "@/lib/brand";

// THE CLOSING BAND. Every reference page ends with one and they are all
// the same composition: a deep forest field, a two-line serif headline
// with the second line in italic, a sentence of body, the conversion
// actions, and a botanical bough at each edge.
//
// ONE COMPONENT, NOT FIVE. The references vary the wording and swap a QR
// panel in and out, but the structure is identical across How It Works,
// What It Does, About, Pricing, Gathering Ideas and Show Us How You
// Gather. Building five bespoke bands would guarantee they drift apart
// the first time one is edited — and §14 asks for "a clear end" that is
// recognisably the same product on every page.
//
// THE ACTIONS ARE ConversionPaths, NOT A DOWNLOAD BUTTON. This is the
// structural half of the founder's instruction that "Download the app"
// must not be the only conversion path: the site's most prominent
// recurring CTA now offers the web first. See lib/conversion.ts.
//
// THE QR IS SECONDARY AND DESKTOP-ONLY. A code shown on the phone you
// would scan it with is useless, and it is gated on a store listing
// existing at all — §18 forbids dead download destinations.

export default function CtaBand({
  headline,
  emphasisLine,
  body,
  showQr = false,
}: {
  headline?: string;
  /** The italic second line — the reference's signature closing move. */
  emphasisLine?: string;
  body?: string;
  showQr?: boolean;
}) {
  const qr = showQr && hasAnyStoreLink();

  return (
    <section className="relative isolate overflow-hidden bg-forest text-offwhite">
      <BotanicalBough
        className="pointer-events-none absolute -left-14 top-1/2 hidden -translate-y-1/2 text-gold/25 lg:block"
        width={210}
      />
      <BotanicalBough
        className="pointer-events-none absolute -right-14 top-1/2 hidden -translate-y-1/2 text-gold/25 lg:block"
        width={210}
        flip
      />

      <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div
          className={`mx-auto grid max-w-4xl gap-10 ${
            qr ? "lg:max-w-none lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16" : ""
          }`}
        >
          <div>
            <Display className="text-3xl leading-tight md:text-[2.6rem]">
              {headline || "Less scrambling."}
            </Display>
            <p className="font-display text-3xl italic leading-tight text-gold md:text-[2.6rem]">
              {emphasisLine || RALLY.split(" ").slice(2).join(" ")}
            </p>

            {body && (
              <p className="mt-5 max-w-xl font-body text-base leading-relaxed text-offwhite/80">
                {body}
              </p>
            )}

            <ConversionPaths tone="dark" className="mt-8" />
          </div>

          {qr && (
            <div className="hidden flex-shrink-0 lg:block">
              <div className="rounded-2xl border border-offwhite/20 bg-offwhite/5 p-6 text-center">
                <div className="rounded-lg bg-offwhite p-3">
                  <QrCode value={APP_DOWNLOAD_URL} size={138} />
                </div>
                <p className="mt-3 max-w-[10rem] font-body text-xs leading-relaxed text-offwhite/80">
                  Scan to download Place &amp; Plenty
                </p>
                <a
                  href={APP_DOWNLOAD_URL}
                  className="mt-2 inline-block font-body text-xs text-offwhite/65 underline decoration-gold underline-offset-4 transition-colors duration-400 hover:text-offwhite"
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
