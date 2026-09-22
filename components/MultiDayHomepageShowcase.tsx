import Link from "next/link";
import { Band, Display } from "@/components/Display";

const ITINERARY = [
  "Friday · Welcome drinks · 7:00 PM",
  "Saturday · Spa time · 11:00 AM",
  "Saturday · Dinner + night out · 7:30 PM",
  "Sunday · Farewell breakfast · 9:30 AM",
];

const BENEFITS = [
  "One guest list",
  "Activity-by-activity RSVPs",
  "Shared itinerary",
  "Who’s bringing what",
  "Multi-day schedule",
];

export default function MultiDayHomepageShowcase() {
  return (
    <Band tone="cream">
      <section
        aria-labelledby="multi-day-home-heading"
        className="mx-auto max-w-editorial px-5 py-10 sm:px-6 md:py-12"
      >
        <div className="overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft">
          <div className="grid lg:grid-cols-[1.02fr_0.98fr]">
            <div className="p-6 sm:p-7 md:p-8">
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/58">
                Example Weekend
              </p>
              <div id="multi-day-home-heading">
                <Display
                  emphasis="Bachelorette Weekend"
                  className="mt-3 text-3xl leading-tight text-forest md:text-[2.45rem]"
                >
                  {"Bachelorette Weekend"}
                </Display>
              </div>

              <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-forest/72 md:text-[0.95rem]">
                Welcome drinks, brunch, spa time, dinner and farewell breakfast can all live inside one connected plan.
              </p>

              <div className="mt-5 grid gap-2">
                {ITINERARY.map((item) => (
                  <div
                    key={item}
                    className="rounded-full bg-parchment px-4 py-2.5 font-body text-xs text-forest/78 sm:text-sm"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {BENEFITS.map((benefit) => (
                  <span
                    key={benefit}
                    className="rounded-full border border-sage/30 bg-cream px-3 py-1.5 font-body text-[0.68rem] font-semibold text-forest/70"
                  >
                    {benefit}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  href="/multi-day"
                  className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite"
                >
                  See How Multi-Day Works
                </Link>
                <Link
                  href="/pricing"
                  className="border-b border-gold pb-1 font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest"
                >
                  See Multi-Day Pricing →
                </Link>
              </div>
            </div>

            <div className="relative min-h-[20rem] overflow-hidden bg-forest lg:min-h-0">
              <img
                src="/images/bachelorette-weekend.webp"
                alt="A diverse group of women celebrating together during a bachelorette weekend getaway"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-forest/35 via-transparent to-transparent"
              />
              <div className="absolute bottom-4 left-4 rounded-full border border-offwhite/30 bg-offwhite/90 px-3 py-1.5 font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest shadow-sm">
                Bachelorette weekends · planned together
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center font-body text-[0.68rem] leading-relaxed text-forest/50">
          Also built for family reunions, wedding weekends, retreats and group trips.
        </p>
      </section>
    </Band>
  );
}
