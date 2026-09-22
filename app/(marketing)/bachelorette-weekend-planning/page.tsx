import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import SearchLeadCapture from "@/components/SearchLeadCapture";
import { BreadcrumbSchema, FaqSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: "Bachelorette Weekend Planning Guide & Planner",
  description:
    "Plan a bachelorette weekend with one guest list, activity RSVPs, a shared schedule, contributions, shopping and budget tools in Place & Plenty.",
  keywords: [
    "bachelorette weekend planning",
    "bachelorette party ideas",
    "bachelorette weekend itinerary",
    "bachelorette party itinerary",
    "bachelorette checklist",
    "bachelorette party planner",
    "bachelorette weekend planner",
    "bachelorette trip planning",
  ],
  alternates: { canonical: "/bachelorette-weekend-planning" },
  openGraph: {
    title: "Bachelorette Weekend Planning | Place & Plenty",
    description:
      "Keep the guest list, itinerary, activity responses, contributions, shopping and weekend details in one connected plan.",
    url: "/bachelorette-weekend-planning",
  },
};

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "calendar",
    title: "Build one weekend plan",
    body: "Keep arrivals, meals, reservations, outings and the farewell brunch in one date range instead of creating separate events.",
  },
  {
    icon: "people",
    title: "Keep one guest list",
    body: "Invite the group once, then keep everyone attached to the same gathering as plans change.",
  },
  {
    icon: "rsvp",
    title: "Track who is doing what",
    body: "Collect activity-level responses when brunch, a spa appointment, dinner or an outing needs its own headcount.",
  },
  {
    icon: "check",
    title: "Coordinate contributions",
    body: "Keep track of who is bringing drinks, snacks, decorations, supplies or anything else the group agreed to cover.",
  },
  {
    icon: "cart",
    title: "Connect shopping and food",
    body: "Keep food, supplies, what you already own and what still needs to be bought connected to the same weekend.",
  },
  {
    icon: "people",
    title: "Plan with co-hosts",
    body: "Share the planning load without splitting the weekend across different notes, texts and versions of the plan.",
  },
];

const FAQS = [
  {
    q: "How do you organize a bachelorette weekend?",
    a: "Start with one date range and one guest list, then break the weekend into activities. Track responses only where an activity needs its own headcount, and keep food, shopping, contributions and changes connected to that same plan.",
  },
  {
    q: "Does everyone need to attend every bachelorette activity?",
    a: "No. A multi-day plan can keep the full group together while still tracking activity-by-activity participation. That is especially useful when reservations, budgets, transportation or personal preferences differ.",
  },
  {
    q: "What should a bachelorette weekend itinerary include?",
    a: "Include the time, location and practical details people need for each activity, plus any reservation, attire, transportation or contribution notes. The goal is a current plan people can actually use, not a decorative schedule that becomes outdated.",
  },
  {
    q: "Can Place & Plenty handle more than one day?",
    a: "Yes. Multi-Day gatherings keep one canonical gathering across the date range, with one guest list and connected planning plus day-by-day activities.",
  },
];

export default function BacheloretteWeekendPlanningPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://placeandplenty.com" },
          {
            name: "Bachelorette Weekend Planning",
            url: "https://placeandplenty.com/bachelorette-weekend-planning",
          },
        ]}
      />
      <FaqSchema faqs={FAQS} />

      <section className="bg-cream">
        <div className="mx-auto grid max-w-editorial items-center gap-10 px-6 py-16 md:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Bachelorette Weekend Planning
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.04] text-forest md:text-6xl">
              Plan the weekend without planning it
              <span className="block italic text-goldInk">in six different places.</span>
            </h1>
            <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-forest/78">
              A bachelorette weekend can mean arrivals, dinner, brunch, appointments,
              activities, transportation, what everyone is bringing and a group chat full
              of changing details. Place &amp; Plenty gives the whole weekend one place to live.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup?next=%2Fhost"
                className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
              >
                Start My Gathering Free
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
              src="/images/gathering-backyard-dinner.png"
              alt="Friends gathered for a warm weekend meal, illustrating a bachelorette weekend planned together"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 48vw, 100vw"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-forest/75 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-offwhite md:p-8">
              <p className="font-body text-[0.64rem] font-bold uppercase tracking-[0.18em] text-gold">
                One group · Different activities · One current plan
              </p>
            </div>
          </div>
        </div>
      </section>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
              Start with the shape of the weekend
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              Enough structure to keep everyone together. Not so much that hosting becomes a project plan.
            </Display>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              ["Friday", "Arrivals + welcome plans", "Arrival details, welcome drinks, dinner and the first night all stay together."],
              ["Saturday", "The full activity day", "Brunch, appointments, outings, dinner and night plans can each have their own details and responses."],
              ["Sunday", "Wrap the weekend well", "Farewell breakfast, checkout notes and final logistics stay visible without another thread."],
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
              The details that usually get scattered across texts, notes and spreadsheets.
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
            topic="bachelorette-weekend"
            gatheringType="Bachelorette Weekend"
            title="Want more bachelorette weekend planning help?"
            body="Join the Place & Plenty Guest List for planning ideas, practical hosting guidance and product updates tied to the kind of gathering you are actually planning."
            buttonLabel="Send Me Planning Ideas"
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
                Search for the idea. Stay for the plan.
              </Display>
              <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
                Inspiration helps you decide what the weekend could be. Place &amp; Plenty is where
                the itinerary, people, responses, contributions and preparation can stay current once
                the ideas become real plans.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Bachelorette itinerary", "Turn ideas into a day-by-day plan."],
                ["Bachelorette checklist", "Keep preparation visible before the weekend."],
                ["Activity planning", "Track who is joining each reservation or outing."],
                ["Group coordination", "Keep one source of truth when plans change."],
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
            Bachelorette weekend planning basics.
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
