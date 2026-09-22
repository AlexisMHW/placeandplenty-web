import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon from "@/components/Icon";

const EXAMPLES = [
  {
    title: "Bachelorette Weekend",
    eyebrow: "Example weekend",
    image: "/images/hero-tabletop.jpg",
    alt: "An elevated Place & Plenty tabletop used to illustrate planning a bachelorette weekend across multiple days",
    body:
      "Welcome drinks Friday. Brunch, spa appointments and dinner Saturday. Farewell breakfast Sunday. Keep one guest list, let people choose activities, and keep the whole weekend in one plan.",
    schedule: [
      "Friday · Welcome drinks · 7:00 PM",
      "Saturday · Brunch · 10:30 AM",
      "Saturday · Spa appointments · 1:00 PM",
      "Saturday · Dinner + night out · 7:30 PM",
      "Sunday · Farewell breakfast · 9:30 AM",
    ],
  },
  {
    title: "Family Reunion",
    eyebrow: "Example reunion",
    image: "/images/show_us_how_you_gather-hero.png",
    alt: "A warm Place & Plenty gathering image used to illustrate planning a family reunion across multiple days",
    body:
      "Arrival night, family breakfast, the cookout, a group outing and the goodbye meal can all live inside the same reunion — with one guest list and activity-by-activity responses.",
    schedule: [
      "Friday · Arrival + welcome dinner · 6:00 PM",
      "Saturday · Family breakfast · 9:00 AM",
      "Saturday · Group outing · 1:00 PM",
      "Saturday · Cookout · 5:30 PM",
      "Sunday · Farewell breakfast · 9:00 AM",
    ],
  },
];

export default function MultiDayHomepageShowcase() {
  return (
    <Band tone="cream">
      <section
        aria-labelledby="multi-day-home-heading"
        className="mx-auto max-w-editorial px-6 py-16 md:py-20"
      >
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              Multi-Day Hosting
            </p>
            <div id="multi-day-home-heading">
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.75rem]">
                One gathering. More than one day.
              </Display>
            </div>
            <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-forest/75">
              Place &amp; Plenty can keep a whole weekend together — one guest list,
              one schedule and one connected planning stack across the days.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/multi-day"
                className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
              >
                See How Multi-Day Works
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-forest/25 bg-offwhite px-6 py-3 font-body text-sm font-semibold text-forest"
              >
                See Multi-Day Pricing
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-gold/30 bg-parchment px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-offwhite">
                <Icon name="calendar" size={19} />
              </span>
              <div>
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.15em] text-forest/50">
                  Built for the whole stretch
                </p>
                <p className="font-display text-lg text-forest">
                  2–4 days, with an extension up to 7
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {EXAMPLES.map((example) => (
            <article
              key={example.title}
              className="overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-forest">
                <Image
                  src={example.image}
                  alt={example.alt}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-forest/75 via-transparent to-transparent"
                />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-offwhite">
                  <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gold">
                    {example.eyebrow}
                  </p>
                  <h3 className="mt-1 font-display text-2xl">{example.title}</h3>
                </div>
              </div>

              <div className="p-6">
                <p className="font-body text-sm leading-relaxed text-forest/75">
                  {example.body}
                </p>
                <ul className="mt-5 space-y-2">
                  {example.schedule.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 rounded-lg bg-cream px-3 py-2 font-body text-xs text-forest/75"
                    >
                      <Icon
                        name="check"
                        size={14}
                        className="mt-0.5 flex-shrink-0 text-goldInk"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-5 text-center font-body text-xs leading-relaxed text-forest/55">
          Examples are illustrative planning scenarios, not customer case studies.
        </p>
      </section>
    </Band>
  );
}
