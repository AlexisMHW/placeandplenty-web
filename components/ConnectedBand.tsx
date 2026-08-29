import Image from "next/image";
import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import ConversionPaths from "@/components/ConversionPaths";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";

// "One seamless experience. Web and app, connected." — the reference's
// forest band, and now a true statement rather than an aspiration: the
// authenticated host web app exists, reads and writes the same canonical
// records, and is gated by the same RLS.
//
// §2's governing architecture — one backend, one canonical record,
// multiple interfaces — is the actual claim here, so the copy says the
// concrete version of it: same account, same gatherings, nothing to sync.
//
// THE REFERENCE'S SPACE MODE COPY IS WRONG AND IS NOT REPEATED. It reads
// "Your guests stay in the app — private, simple, and distraction-free",
// which describes the guest experience, not Space Mode. Space Mode is
// about working out how a ROOM flows, from a photograph of it. Product
// truth comes from the reconciliation document; the reference governs
// composition. So the third column keeps the reference's shape and says
// what Space Mode actually is — and why it stays native (§29 requires a
// product reason, not "the app already has it").
//
// THE FOUR CONVERSION PATHS LIVE HERE, and this is the right band for
// them rather than an arbitrary one: it is the band that has just
// finished explaining that web and app are the same product on the same
// account. The choice between "start on the web" and "get it on your
// phone" is only a comfortable choice once someone believes that, which
// is why the promise sits directly above the buttons rather than in the
// footer somewhere.

const COLUMNS = [
  {
    label: "Plan on the web",
    body: "Create, organise and edit from a proper keyboard — your gatherings, guests, menu and list, on a screen big enough to see all of it.",
  },
  {
    label: "Host Mode",
    body: "On the day, on your phone: what to do right now, with the notifications that make it useful. Native, because that is where you'll be standing.",
  },
  {
    label: "Space Mode",
    body: "Work out how the room actually flows before you move furniture. Native, because it starts with a camera pointed at the room.",
  },
];

export default function ConnectedBand() {
  return (
    <Band tone="forest">
      <BotanicalSprig
        className="pointer-events-none absolute -left-6 bottom-2 hidden text-offwhite/15 lg:block"
        size={170}
      />

      <div className="relative mx-auto grid max-w-editorial items-center gap-12 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-gold">
            How it works
          </p>

          <Display
            emphasis="connected"
            className="mt-4 text-3xl leading-tight text-offwhite md:text-4xl"
          >
            One seamless experience. Web and app, connected.
          </Display>

          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
            The same account and the same gatherings, wherever you open
            them. Plan at the kitchen table on a laptop, carry it in your
            pocket on the day. Nothing to sync, nothing to import.
          </p>

          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((c) => (
              <li key={c.label}>
                <span aria-hidden className="mb-3 block h-px w-8 bg-gold" />
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.16em] text-gold">
                  {c.label}
                </h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-offwhite/80">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-prose border-l-2 border-gold pl-5 font-body text-base leading-relaxed text-offwhite/85">
            {CROSS_PLATFORM_PROMISE}
          </p>

          <ConversionPaths tone="dark" showNote={false} className="mt-8" />

          <Link
            href="/how-it-works"
            className="mt-8 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-offwhite transition-colors duration-400 hover:text-gold"
          >
            See how it works
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>

        {/* The product, shown in context rather than as a screenshot wall
            (§32). One device, cropped by its own frame. */}
        <div className="mx-auto w-full max-w-[17rem] lg:max-w-[19rem]">
          <div className="overflow-hidden rounded-[2rem] border border-offwhite/25 shadow-lift">
            <Image
              src="/images/hero-app-screen.png"
              alt="Place & Plenty on a phone, showing a gathering at 82% HostReady with what's left to do."
              width={510}
              height={1080}
              sizes="(min-width: 1024px) 19rem, 60vw"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </Band>
  );
}
