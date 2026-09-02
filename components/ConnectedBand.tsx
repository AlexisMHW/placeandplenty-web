import Image from "next/image";
import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import ConversionPaths from "@/components/ConversionPaths";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";

const COLUMNS = [
  {
    label: "Plan on the web",
    body: "Create, organise and edit from a proper keyboard — your gatherings, guests, menu and list, on a screen big enough to see all of it.",
  },
  {
    label: "Carry it with you",
    body: "Open the same gathering on your phone when you leave the kitchen table. Same account, same information, no handoff to manage.",
  },
  {
    label: "Use the phone when it matters",
    body: "Host Mode and Space Mode stay native because they rely on notifications and the camera — exactly where the phone is useful.",
  },
];

function WebPreview() {
  return (
    <div className="relative w-full max-w-[31rem]">
      <div className="overflow-hidden rounded-[1.35rem] border border-offwhite/20 bg-offwhite shadow-lift">
        <div className="flex items-center gap-2 border-b border-sage/20 bg-parchment px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-sage/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-sage/35" />
          <span className="h-2.5 w-2.5 rounded-full bg-sage/25" />
          <span className="ml-3 h-6 flex-1 rounded-md bg-offwhite" />
        </div>

        <div className="grid min-h-[19rem] grid-cols-[5.5rem_1fr] bg-offwhite">
          <div className="bg-forest px-3 py-5">
            <p className="font-display text-[0.66rem] leading-tight text-offwhite">
              Place &amp;<br />Plenty
            </p>
            <div className="mt-7 space-y-2.5">
              {["Gathering", "My Table", "My People", "Shopping", "Closet"].map((item, i) => (
                <div
                  key={item}
                  className={`rounded-md px-2 py-1.5 font-body text-[0.48rem] ${
                    i === 0 ? "bg-offwhite/14 text-offwhite" : "text-offwhite/65"
                  }`}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-5">
            <p className="font-body text-[0.5rem] font-bold uppercase tracking-[0.18em] text-forest/50">
              Saturday dinner
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-xl text-forest">You’re 82% HostReady.</p>
                <p className="mt-1 font-body text-[0.56rem] text-forest/55">A few things left. Nothing dramatic.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-[4px] border-gold font-display text-xs text-forest">
                82%
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["My Table", "6 dishes"],
                ["My People", "12 coming"],
                ["My Shopping", "4 left"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-sage/20 bg-parchment p-3">
                  <p className="font-body text-[0.46rem] uppercase tracking-[0.1em] text-forest/50">{label}</p>
                  <p className="mt-1 font-display text-sm text-forest">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-gold/30 bg-cream p-3">
              <p className="font-body text-[0.46rem] font-bold uppercase tracking-[0.12em] text-forest/50">Next up</p>
              <p className="mt-1 font-body text-[0.58rem] text-forest/75">Confirm ice, assign the salad, and you’re almost there.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[58%] rounded-b-xl bg-offwhite/35" />
    </div>
  );
}

export default function ConnectedBand() {
  return (
    <Band tone="forest">
      <BotanicalSprig
        className="pointer-events-none absolute -left-6 bottom-2 hidden text-offwhite/15 lg:block"
        size={170}
      />

      <div className="relative mx-auto grid max-w-editorial items-center gap-12 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-gold">
            Web + mobile
          </p>

          <Display
            emphasis="connected"
            className="mt-4 text-3xl leading-tight text-offwhite md:text-4xl"
          >
            One seamless experience. Web and app, connected.
          </Display>

          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
            Plan from your computer when you want the room to think. Pick up the
            same gathering on your phone when you need it in your hand. One
            account. One gathering. Nothing to sync.
          </p>

          <ul className="mt-9 grid gap-6 sm:grid-cols-3">
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

        <div className="relative mx-auto w-full max-w-[36rem] pb-5 pt-4">
          <WebPreview />

          <div className="absolute -bottom-3 right-0 w-[9.5rem] overflow-hidden rounded-[1.75rem] border border-offwhite/30 bg-forest shadow-lift sm:right-4 sm:w-[10.5rem] lg:-right-2 lg:w-[11.5rem]">
            <Image
              src="/images/hero-app-screen.png"
              alt="Place & Plenty mobile app showing the same gathering on a phone."
              width={510}
              height={1080}
              sizes="12rem"
              className="h-auto w-full object-cover"
            />
          </div>

          <p className="mt-7 max-w-[24rem] font-display text-base italic leading-relaxed text-offwhite/70 sm:pr-20">
            Start on the screen that suits the moment. Your gathering follows you.
          </p>
        </div>
      </div>
    </Band>
  );
}
