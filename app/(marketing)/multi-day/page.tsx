import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import { MULTI_DAY_NOTE, MULTI_DAY_PRICING } from "@/lib/pricing";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";
import { FaqSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: "Multi-Day Gathering Planning",
  description:
    "Plan a multi-day gathering, reunion, wedding weekend, retreat or family visit with one guest list, one schedule and connected planning in Place & Plenty.",
  keywords: [
    "multi-day gathering planner",
    "family reunion planning app",
    "family reunion planner",
    "bachelorette weekend planner",
    "bachelorette itinerary app",
    "wedding weekend planning",
    "group weekend planner",
    "multi-day event planning app",
    "reunion itinerary planner",
    "weekend hosting planner",
  ],
  alternates: { canonical: "/multi-day" },
  openGraph: {
    title: "Multi-Day Hosting | Place & Plenty",
    description:
      "One gathering. More than one day. Keep the people, schedule, activities and planning connected from start to finish.",
    url: "/multi-day",
  },
};

const WHO = [
  "Bachelorette weekends",
  "Family reunions",
  "Wedding weekends",
  "Retreats and group weekends",
  "Milestone birthdays",
  "Holiday weekends",
  "Out-of-town family visits",
];

const FLOW: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "calendar",
    title: "Choose the full date range",
    body: "Start with 2–4 calendar days in the gathering wizard. If the plan grows, the same gathering can extend to as many as 7 days.",
  },
  {
    icon: "people",
    title: "Keep one guest list",
    body: "Invitations, RSVPs, My People and My Guest Book stay attached to one gathering instead of splitting the weekend into disconnected events.",
  },
  {
    icon: "table",
    title: "Build the day-by-day schedule",
    body: "Create activities for each day with times, locations, capacity, transportation, attire, reservation notes and provider details.",
  },
  {
    icon: "rsvp",
    title: "Let guests respond to activities",
    body: "Guests can see the schedule they are meant to see and respond per person when an activity needs its own headcount or selection.",
  },
  {
    icon: "cart",
    title: "Connect the rest of the plan",
    body: "Link My Table, My Shopping, Who’s Bringing What and expenses to the day or activity they belong to without creating duplicate planning systems.",
  },
  {
    icon: "sun",
    title: "Plan for the whole stretch",
    body: "Figure It Out and weather use the full Multi-Day date range, so preparation and contingencies can make sense across the gathering instead of only on day one.",
  },
];

const FAQS = [
  {
    q: "What is a Multi-Day gathering in Place & Plenty?",
    a: "It is one canonical gathering that spans 2–4 calendar days, with one guest list and one planning stack plus a day-by-day schedule. A one-time extension can expand that same gathering to as many as 7 days.",
  },
  {
    q: "Do I need a separate event for each day?",
    a: "No. The point of Multi-Day is to keep the weekend or multi-day gathering together instead of rebuilding guests, planning and history for each day.",
  },
  {
    q: "Can guests RSVP to individual activities?",
    a: "Yes. Hosts can make activities selectable or collect per-person activity responses when a meal, outing or reservation needs its own headcount.",
  },
  {
    q: "Can I use Multi-Day on the web and in the app?",
    a: "Yes. Multi-Day planning and My Schedule use the same canonical backend across web and mobile. Host Mode and Space Mode remain intentionally mobile-only.",
  },
];

const DIFFERENCE = [
  ["One gathering record", "No rebuilding people, details or history for every day."],
  ["One connected schedule", "Days and activities stay inside the same planning context."],
  ["Activity-level responses", "Know who is joining what, not just who is coming overall."],
  ["Capacity-aware choices", "Selectable activities can stop accepting new selections when they fill."],
  ["Connected costs", "Track activity costs without turning Place & Plenty into a separate accounting system."],
  ["Web + mobile", "Plan on the bigger screen, then carry the same gathering with you."],
];

export default function MultiDayPage() {
  return (
    <>
      <FaqSchema faqs={FAQS} />
      <section className="relative overflow-hidden bg-cream">
        <div className="mx-auto grid max-w-editorial items-center gap-12 px-6 py-16 md:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Multi-Day Hosting
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.04] text-forest md:text-6xl">
              One gathering.
              <span className="block italic text-goldInk">More than one day.</span>
            </h1>
            <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-forest/78">
              A weekend, reunion, retreat or family celebration should not become three separate plans just because it crosses midnight. Multi-Day keeps the people, schedule, activities and preparation inside one Place &amp; Plenty gathering.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite">
                Start Hosting Free
              </Link>
              <Link href="/pricing" className="rounded-full border border-forest/25 bg-offwhite/60 px-6 py-3 font-body text-sm font-semibold text-forest">
                See Multi-Day Pricing
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-sage/25 bg-parchment p-5 shadow-soft md:p-7">
            <div className="rounded-2xl border border-sage/25 bg-offwhite p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-forest/50">My Schedule</p>
                  <h2 className="mt-1 font-display text-2xl text-forest">The Reunion Weekend</h2>
                </div>
                <span className="rounded-full bg-sage/15 px-3 py-1.5 font-body text-xs font-semibold text-forest">3 days</span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  ["Day 1", "Friday", "Welcome dinner · 6:30 PM", "32 coming"],
                  ["Day 2", "Saturday", "Family brunch · 10:00 AM", "Boat day · 1:00 PM"],
                  ["Day 3", "Sunday", "Farewell breakfast · 9:30 AM", "Checkout · 11:00 AM"],
                ].map(([day, title, a, b]) => (
                  <div key={day} className="rounded-xl border border-sage/20 bg-cream px-4 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.14em] text-forest/50">{day}</p>
                      <p className="font-display text-lg text-forest">{title}</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <span className="rounded-lg bg-offwhite px-3 py-2 font-body text-xs text-forest/70">{a}</span>
                      <span className="rounded-lg bg-offwhite px-3 py-2 font-body text-xs text-forest/70">{b}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-center font-body text-xs leading-relaxed text-forest/55">
              One guest list. One plan. Day-by-day detail when you need it.
            </p>
          </div>
        </div>
      </section>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/60">Built for the gatherings that keep going</p>
              <Display className="mt-3 text-3xl leading-tight text-forest md:text-[2.5rem]">The day changed. The gathering didn’t.</Display>
              <p className="mt-4 font-body text-base leading-relaxed text-forest/75">{MULTI_DAY_NOTE}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {WHO.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-forest/10 bg-offwhite/70 px-4 py-3 font-body text-sm font-semibold text-forest">
                  <Icon name="check" size={17} className="text-goldInk" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              See it in real life
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              Two weekends. One connected way to plan them.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
              Multi-Day is built around what hosts actually have to coordinate — not a generic project board.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft">
              <div className="relative aspect-[16/9]">
                <Image
                  src="/images/bachelorette-weekend.webp"
                  alt="A diverse group of women celebrating a bachelorette weekend getaway together"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
              <div className="p-6">
                <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.16em] text-goldInk">
                  Bachelorette Weekend
                </p>
                <h3 className="mt-2 font-display text-2xl text-forest">
                  Everyone does not have to do everything.
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">
                  Keep the whole weekend in one gathering: arrival drinks, brunch, spa appointments, dinner and the farewell breakfast. Guests can respond to the activities that need a headcount while the host keeps one guest list and one plan.
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {[
                    "Activity selections",
                    "Reservation details",
                    "Transportation notes",
                    "Attire notes",
                    "Day-by-day schedule",
                    "One guest list",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 font-body text-sm text-forest/70">
                      <Icon name="check" size={15} className="text-goldInk" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="overflow-hidden rounded-3xl border border-sage/25 bg-offwhite shadow-soft">
              <div className="relative aspect-[16/9]">
                <Image
                  src="/images/harding-family-reunion.webp"
                  alt="The Harding Family Reunion with multiple generations wearing coordinated reunion shirts"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
              <div className="p-6">
                <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.16em] text-goldInk">
                  Family Reunion
                </p>
                <h3 className="mt-2 font-display text-2xl text-forest">
                  One family. Several households. A whole weekend to coordinate.
                </h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">
                  Arrival night, family breakfast, the outing, the cookout and the goodbye meal can all stay inside the same reunion. Keep one guest list while collecting activity-level responses only where you need them.
                </p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {[
                    "Multiple households",
                    "Activity headcounts",
                    "Capacity limits",
                    "What to bring",
                    "Food + shopping links",
                    "Weather across the weekend",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 font-body text-sm text-forest/70">
                      <Icon name="check" size={15} className="text-goldInk" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>

          <p className="mt-5 text-center font-body text-xs leading-relaxed text-forest/55">
            These are illustrative planning scenarios, not customer case studies.
          </p>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">How it works</p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">Structure the weekend without turning it into a project plan.</Display>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FLOW.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-sage/25 bg-offwhite p-6 shadow-softer">
                <div className="flex items-center justify-between">
                  <Icon name={step.icon} size={25} className="text-forest/70" />
                  <span className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-goldInk">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-4 font-display text-xl text-forest">{step.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/60">What makes it different</p>
              <Display className="mt-3 text-3xl leading-tight text-forest md:text-[2.35rem]">Not a stack of events pretending to be one weekend.</Display>
              <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
                Multi-Day keeps one canonical gathering underneath the experience. That means the people, access, history and consequences stay together while the schedule gets as detailed as the host needs.
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              {DIFFERENCE.map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-sage/25 bg-offwhite p-5">
                  <dt className="font-display text-lg text-forest">{title}</dt>
                  <dd className="mt-2 font-body text-sm leading-relaxed text-forest/70">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Band>

      <Band tone="forest">
        <div className="mx-auto max-w-editorial px-6 py-14 text-offwhite md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-gold">Cross-platform by design</p>
              <h2 className="mt-3 font-display text-3xl leading-tight">Plan on the web. Carry it on your phone.</h2>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-offwhite/75">{CROSS_PLATFORM_PROMISE}</p>
            </div>
            <div className="flex gap-3 text-gold">
              <Icon name="laptop" size={42} />
              <Icon name="phone" size={42} />
            </div>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-prose px-6 py-14 md:py-16">
          <Display className="text-2xl text-forest md:text-3xl">Questions about Multi-Day</Display>
          <dl className="mt-7 divide-y divide-sage/30">
            {FAQS.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-body text-base font-bold text-forest">{item.q}</dt>
                <dd className="mt-2 font-body text-base leading-relaxed text-forest/78">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:items-center">
            <div>
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.2em] text-forest/60">Multi-Day pricing</p>
              <Display className="mt-3 text-3xl leading-tight text-forest">Pay for the gathering you are actually planning.</Display>
              <p className="mt-4 font-body text-sm leading-relaxed text-forest/70">
                Existing Place &amp; Plenty access changes the Multi-Day rate. The capability is the same; the price reflects what the host already has.
              </p>
              <Link href="/pricing" className="mt-6 inline-flex border-b border-gold pb-1 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest">
                See full pricing →
              </Link>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ["Standard", MULTI_DAY_PRICING.standard.priceLine],
                ["With Gathering Pass", MULTI_DAY_PRICING.gathering_pass.priceLine],
                ["With Plus", MULTI_DAY_PRICING.plus.priceLine],
                ["Days 5–7 extension", MULTI_DAY_PRICING.extension.priceLine],
              ].map(([label, price]) => (
                <div key={label} className="rounded-2xl border border-sage/25 bg-offwhite px-5 py-5">
                  <dt className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-forest/55">{label}</dt>
                  <dd className="mt-2 font-display text-xl text-forest">{price}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Band>
    </>
  );
}
