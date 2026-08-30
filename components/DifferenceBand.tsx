import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import Icon, { type IconName } from "@/components/Icon";

const GUEST_FLOW: { name: string; icon: IconName }[] = [
  { name: "Invitations", icon: "envelope" },
  { name: "RSVPs", icon: "rsvp" },
  { name: "My People", icon: "people" },
  { name: "Who’s Bringing What", icon: "dish" },
  { name: "My Guest Book", icon: "book" },
];

const CLOSET_EXAMPLES = [
  "12 wine glasses",
  "2 serving platters",
  "Cloth napkins",
  "Large beverage dispenser",
];

export default function DifferenceBand() {
  return (
    <Band tone="sage">
      <BotanicalSprig
        className="pointer-events-none absolute -right-8 bottom-0 hidden text-olive/30 lg:block"
        size={220}
      />

      <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div className="max-w-3xl">
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-forest/65">
            More than a planning checklist
          </p>
          <Display
            emphasis="together"
            className="mt-4 text-3xl leading-tight text-forest md:text-[2.65rem]"
          >
            The useful part is what Place & Plenty remembers together.
          </Display>
          <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed text-forest/80">
            Your menu, guests, shopping, contributions, what you already own,
            and what still needs doing are not separate little lists. They work
            together around one gathering.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-2xl border border-sage/30 bg-offwhite p-7 shadow-softer md:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">
                  Your people, connected
                </p>
                <h3 className="mt-2 font-display text-2xl leading-snug text-forest">
                  An invitation is the beginning, not the whole product.
                </h3>
              </div>
              <span className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-forest text-offwhite sm:inline-flex">
                <Icon name="people" size={23} />
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              {GUEST_FLOW.map((item, index) => (
                <div key={item.name} className="contents">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sage/30 bg-parchment px-3.5 py-2 font-body text-sm font-semibold text-forest">
                    <Icon name={item.icon} size={16} className="text-goldInk" />
                    {item.name}
                  </span>
                  {index < GUEST_FLOW.length - 1 && (
                    <span aria-hidden className="font-body text-sm text-forest/40">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-8 font-body text-base leading-relaxed text-forest/75">
              Invite them, know who is coming, keep track of what they are
              bringing, and save the people you host most for next time. No
              rebuilding the same guest list every time people come over.
            </p>

            <div className="mt-8 border-l-2 border-gold pl-5">
              <p className="font-display text-xl italic leading-snug text-forest">
                Got your own invitations? Bring them over. Yeah, we handle that
                too.
              </p>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-forest p-7 text-offwhite shadow-lift md:p-9">
            <BotanicalSprig
              className="pointer-events-none absolute -right-5 -top-4 text-offwhite/12"
              size={145}
            />

            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-offwhite/10 text-gold">
                  <Icon name="closet" size={22} />
                </span>
                <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-gold">
                  My Hosting Closet
                </p>
              </div>

              <Display
                emphasis="again"
                className="mt-5 text-3xl leading-tight text-offwhite"
              >
                Stop buying things you already own again.
              </Display>

              <p className="mt-4 font-body text-base leading-relaxed text-offwhite/80">
                Keep the serving pieces, linens, glasses, decor and hosting
                basics you already have in one place — then let your gathering
                plan start with what is already in your house.
              </p>

              <div className="mt-7 rounded-xl border border-offwhite/15 bg-offwhite/7 p-5">
                <p className="font-body text-xs font-bold uppercase tracking-[0.16em] text-offwhite/60">
                  Already in your Hosting Closet
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {CLOSET_EXAMPLES.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 font-body text-sm text-offwhite/90">
                      <Icon name="check" size={16} className="flex-shrink-0 text-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-6 font-display text-xl italic leading-snug text-gold">
                The smartest shopping list sometimes starts with: don’t buy it.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl font-body text-sm leading-relaxed text-forest/70">
            HostReady™ can see the bigger picture too — what is decided, what is
            still open, and what deserves your attention next.
          </p>
          <Link
            href="/what-it-does"
            className="inline-flex flex-shrink-0 items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See what it does
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </Band>
  );
}
