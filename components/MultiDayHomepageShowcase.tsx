import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "calendar",
    title: "Plan the whole weekend",
    body: "Keep Friday through Sunday together, with separate activities, times, locations and details.",
  },
  {
    icon: "people",
    title: "One guest list, different plans",
    body: "Keep everyone in one gathering while tracking who is joining each activity.",
  },
  {
    icon: "rsvp",
    title: "Collect activity responses",
    body: "Know who is coming to brunch, the spa, dinner or the night out without chasing a group chat.",
  },
  {
    icon: "check",
    title: "Coordinate what people bring",
    body: "Track drinks, snacks, decorations, supplies and contributions in the same plan.",
  },
  {
    icon: "cart",
    title: "Connect food, shopping and budget",
    body: "Keep My Table, My Shopping List, My Hosting Closet and My Budget connected to the weekend.",
  },
  {
    icon: "people",
    title: "Share the work",
    body: "Co-hosts can help manage the weekend instead of every decision sitting with one person.",
  },
];

export default function MultiDayHomepageShowcase() {
  return (
    <Band tone="cream">
      <section
        aria-labelledby="multi-day-home-heading"
        className="mx-auto max-w-editorial px-6 py-16 md:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              Multi-Day Gatherings
            </p>
            <div id="multi-day-home-heading">
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.75rem]">
                One weekend. A lot of moving pieces. One place to keep it together.
              </Display>
            </div>
            <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-forest/75">
              A bachelorette weekend is not one event. It is arrivals, dinner reservations,
              brunch, activities, who said yes to what, what everyone is bringing and a group
              of people who need to know where they are supposed to be. Place &amp; Plenty keeps
              the whole weekend inside one connected gathering.
            </p>

            <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="border-t border-sage/35 pt-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-parchment text-forest">
                      <Icon name={feature.icon} size={17} />
                    </span>
                    <div>
                      <h3 className="font-display text-lg text-forest">{feature.title}</h3>
                      <p className="mt-1 font-body text-sm leading-relaxed text-forest/68">
                        {feature.body}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/bachelorette-weekend-planning"
                className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
              >
                Plan a Bachelorette Weekend
              </Link>
              <Link
                href="/multi-day"
                className="border-b border-gold pb-1 font-body text-sm font-semibold text-forest"
              >
                See how Multi-Day works →
              </Link>
            </div>

            <p className="mt-5 font-body text-xs leading-relaxed text-forest/55">
              Also built for family reunions, wedding weekends, retreats, group trips and other gatherings that span more than one day.
            </p>
          </div>

          <article className="overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft">
            <div className="relative aspect-[4/3] overflow-hidden bg-forest">
              <Image
                src="/images/article-night-before-list.png"
                alt="Friends preparing together in a warm home, illustrating a multi-day bachelorette weekend plan"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 45vw, 100vw"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-offwhite md:p-8">
                <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.18em] text-gold">
                  Example · Bachelorette Weekend
                </p>
                <h3 className="mt-2 font-display text-3xl leading-tight">
                  Everyone does not have to do everything.
                </h3>
                <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-offwhite/82">
                  One guest list. Activity-by-activity responses. One current plan from arrival drinks through farewell brunch.
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </Band>
  );
}
