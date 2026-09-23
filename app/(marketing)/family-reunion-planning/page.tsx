import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import SearchLeadCapture from "@/components/SearchLeadCapture";
import { BreadcrumbSchema, FaqSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: "Family Reunion Planning Guide & Planner",
  description:
    "Plan a family reunion with one guest list, a shared weekend schedule, activity RSVPs, contributions, food, shopping and budget tools in Place & Plenty.",
  keywords: [
    "family reunion planning",
    "family reunion planner",
    "family reunion checklist",
    "family reunion itinerary",
    "family reunion ideas",
    "family reunion planning app",
    "family reunion weekend planner",
    "how to plan a family reunion",
  ],
  alternates: { canonical: "/family-reunion-planning" },
  openGraph: {
    title: "Family Reunion Planning | Place & Plenty",
    description:
      "Keep households, activities, meals, contributions, shopping and weekend details in one connected family reunion plan.",
    url: "/family-reunion-planning",
  },
};

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "people",
    title: "One reunion guest list",
    body: "Keep relatives and households attached to one gathering instead of rebuilding lists for every meal and activity.",
  },
  {
    icon: "calendar",
    title: "Plan the whole reunion",
    body: "Keep arrival night, breakfasts, outings, the cookout and the goodbye meal inside one day-by-day plan.",
  },
  {
    icon: "rsvp",
    title: "Track activity headcounts",
    body: "Know who is joining the outing, dinner or other capacity-sensitive activities without another spreadsheet.",
  },
  {
    icon: "check",
    title: "Coordinate what families bring",
    body: "Track food, drinks, games, supplies and other contributions across households.",
  },
  {
    icon: "cart",
    title: "Connect meals and shopping",
    body: "Keep menus, serving needs, shopping and what the family already has connected to the gathering.",
  },
  {
    icon: "people",
    title: "Share reunion planning",
    body: "Use co-hosts so one person does not become the family information desk for the entire weekend.",
  },
];

const FAQS = [
  {
    q: "How do you organize a family reunion?",
    a: "Start with the date range, the people and the major shared moments. Build one reunion schedule, then add activity-level responses only where you need a separate headcount. Keep meals, contributions, shopping and updates attached to the same plan.",
  },
  {
    q: "How far in advance should you plan a family reunion?",
    a: "The larger the group and the more travel involved, the earlier you should start. Lock the broad date and location first, then collect attendance and activity information as plans become more specific.",
  },
  {
    q: "What should a family reunion itinerary include?",
    a: "Include the time and location of major meals and activities, arrival or transportation notes, what people should bring, and anything that affects participation. Keep it current so relatives are not relying on an old screenshot or text thread.",
  },
  {
    q: "Can different family members attend different reunion activities?",
    a: "Yes. Place & Plenty Multi-Day gatherings can keep one reunion guest list while collecting responses for individual activities that need their own headcount or selection.",
  },
  {
    q: "Can Place & Plenty handle a multi-day family reunion?",
    a: "Yes. Multi-Day keeps one canonical gathering across the reunion date range, with one guest list and connected planning plus day-by-day activities.",
  },
];

export default function FamilyReunionPlanningPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://placeandplenty.com" },
          {
            name: "Family Reunion Planning",
            url: "https://placeandplenty.com/family-reunion-planning",
          },
        ]}
      />
      <FaqSchema faqs={FAQS} />

      <section className="bg-cream">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 py-16 md:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Family Reunion Planning
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.04] text-forest md:text-6xl">
              One family reunion.
              <span className="block italic text-goldInk">A lot of people to keep together.</span>
            </h1>
            <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-forest/78">
              Family reunions can mean several households, travel plans, meals, an outing,
              a cookout, people bringing things and relatives joining different parts of the
              weekend. Place &amp; Plenty gives the reunion one current plan instead of a trail
              of group texts and spreadsheets.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup?next=%2Fhost"
                className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
              >
                Start My Reunion Free
              </Link>
              <Link
                href="/multi-day"
                className="rounded-full border border-forest/25 bg-offwhite/70 px-6 py-3 font-body text-sm font-semibold text-forest"
              >
                See Multi-Day Planning
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-sage/25 bg-forest shadow-soft">
            <Image
              src="/images/harding-family-reunion.webp"
              alt="The Harding Family Reunion with multiple generations in coordinated reunion shirts at an outdoor family celebration"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest/75 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-offwhite md:p-8">
              <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.18em] text-gold">
                One family · Several households · One current plan
              </p>
            </div>
          </div>
        </div>
      </section>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              Build around the reunion people are actually attending
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              One weekend can hold a lot without becoming five separate events.
            </Display>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              ["Friday", "Arrivals + welcome dinner", "Keep arrival notes, the first meal and early family time visible in the same reunion."],
              ["Saturday", "The big reunion day", "Breakfast, outings, games, the cookout and activity headcounts can each have the detail they need."],
              ["Sunday", "Farewell + next time", "Keep breakfast, checkout notes, photos and the last logistics together through the end."],
            ].map(([day, title, body]) => (
              <article key={day} className="rounded-2xl border border-forest/10 bg-offwhite/75 p-6">
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-goldInk">{day}</p>
                <h2 className="mt-2 font-display text-xl text-forest">{title}</h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              What Place &amp; Plenty keeps connected
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.55rem]">
              The reunion details that usually end up scattered across relatives.
            </Display>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="border-t border-sage/30 pt-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream text-forest">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h2 className="mt-4 font-display text-xl text-forest">{feature.title}</h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/75">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-4xl px-6 py-14 md:py-16">
          <SearchLeadCapture
            topic="family-reunion"
            gatheringType="Family Reunion"
            title="Want more family reunion planning help?"
            body="Join the Place & Plenty Guest List for reunion planning ideas, practical hosting guidance and product updates tied to the kind of gathering you are actually planning."
            buttonLabel="Send Me Reunion Planning Ideas"
          />
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
                Plan around the real questions
              </p>
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.45rem]">
                Search for the reunion idea. Stay for the plan.
              </Display>
              <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
                Inspiration helps with themes, games and menus. Place &amp; Plenty is where
                attendance, activity headcounts, meals, contributions and the current itinerary
                can stay useful once the reunion becomes real.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Family reunion itinerary", "Turn the weekend into a clear day-by-day plan."],
                ["Family reunion checklist", "Keep preparation visible before relatives arrive."],
                ["Meal + contribution planning", "Know who is bringing what and what is still needed."],
                ["Household coordination", "Keep one source of truth as attendance and plans change."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl border border-sage/25 bg-offwhite p-5">
                  <h2 className="font-display text-lg text-forest">{title}</h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
          <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
            Questions, answered
          </p>
          <Display className="mt-4 text-3xl text-forest md:text-[2.45rem]">
            Family reunion planning basics.
          </Display>
          <dl className="mt-8 divide-y divide-sage/30 border-y border-sage/30">
            {FAQS.map((faq) => (
              <div key={faq.q} className="py-6">
                <dt className="font-display text-xl text-forest">{faq.q}</dt>
                <dd className="mt-3 font-body text-base leading-relaxed text-forest/75">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>
    </>
  );
}
