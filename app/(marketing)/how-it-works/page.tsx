import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Icon, { type IconName } from "@/components/Icon";
import { Band, Display } from "@/components/Display";
import hero from "../../../how-it-works/how-it-works-hero.png";
import peopleFirst from "../../../homepage/product-invitations.png";
import planWithConfidence from "../../../how-it-works/how-it-works-plan-with-confidence.png";
import readyForTheDay from "../../../how-it-works/how-it-works-ready-for-the-day.png";
import connectedExperience from "../../../how-it-works/how-it-works-connected-experience - Copy.png";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "From people are coming to come on in. See how Place & Plenty supports the real hosting journey from first details through gathering day.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "/how-it-works" },
};

const JOURNEY: Array<{
  label: string;
  detail: string;
  icon: IconName;
}> = [
  { label: "Start", detail: "Create the gathering.", icon: "calendar" },
  { label: "Bring In Your People", detail: "Invite, RSVP, organize.", icon: "people" },
  { label: "Plan It", detail: "Food, shopping, what you own.", icon: "table" },
  { label: "Get Ready", detail: "Know what needs attention next.", icon: "gauge" },
  { label: "Gather", detail: "Host, enjoy, remember.", icon: "heart" },
];

const STORY = [
  {
    eyebrow: "People first",
    title: "Bring in your people without losing track of the details.",
    body: "Send the invitation, follow RSVPs and keep the guest list organized in the same gathering. My People keeps responses and guest details close, while My Guest Book makes familiar people easier to bring back next time.",
    image: peopleFirst,
    alt: "Place & Plenty invitation experience for inviting guests and tracking responses.",
  },
  {
    eyebrow: "Plan with confidence",
    title: "Food, shopping and what you already own work together.",
    body: "Build the menu in My Table, keep the shopping list tied to the plan and check My Hosting Closet before buying more. Quantities, contributions and the pieces you already have stay connected to the gathering instead of scattered across separate lists.",
    image: planWithConfidence,
    alt: "Place & Plenty planning experience showing My Table, My Shopping and My Hosting Closet working together.",
  },
  {
    eyebrow: "Ready for the day",
    title: "Know what matters now — and what can wait.",
    body: "HostReady and Next Up turn the plan into a clear sense of readiness as the gathering gets closer. Space Mode and Host Mode support the final stretch so gathering day feels less like managing a project and more like welcoming people in.",
    image: readyForTheDay,
    alt: "Place & Plenty gathering-day experience with HostReady and next-step guidance.",
  },
  {
    eyebrow: "Connected experience",
    title: "Plan on the web. Carry the same gathering with you on your phone.",
    body: "The gathering stays with the same account across web and mobile. Use the bigger screen when you want room to plan, then take the useful parts with you while you shop, set up and host.",
    image: connectedExperience,
    alt: "Place & Plenty web and mobile experience shown together for the same gathering.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How It Works"
        headline="From people are coming"
        emphasisLine="to come on in."
        image={hero.src}
        imageAlt="A warm, evergreen Place & Plenty home gathering."
        imageCaption="One connected hosting journey, from the first details through gathering day."
        body={
          <p>
            Start with the gathering, bring in your people, build the plan, get ready, and host with the same connected Place &amp; Plenty experience from beginning to end.
          </p>
        }
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
            >
              Start Hosting Free
            </Link>
            <Link
              href="/what-it-does"
              className="inline-flex items-center justify-center rounded-lg border border-forest/25 bg-offwhite/70 px-6 py-3 font-body text-sm font-semibold text-forest transition-colors duration-300 hover:bg-offwhite"
            >
              See What It Does
            </Link>
          </div>
        }
      />

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-5 py-14 md:px-6 md:py-18">
          <div className="text-center">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">The hosting journey</p>
            <Display className="mx-auto mt-4 max-w-3xl text-3xl leading-tight text-forest md:text-[2.5rem]">One gathering. Five simple moments.</Display>
          </div>
          <div className="relative mt-12 md:mt-14">
            <div aria-hidden className="absolute left-[10%] right-[10%] top-9 hidden h-[2px] bg-gold/70 md:block" />
            <ol className="grid gap-8 md:grid-cols-5 md:gap-4">
              {JOURNEY.map((step, index) => (
                <li key={step.label} className="relative text-center">
                  <div className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-gold bg-parchment text-goldInk shadow-softer"><Icon name={step.icon} size={32} strokeWidth={1.9} /></div>
                  <p className="mt-4 font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">{String(index + 1).padStart(2, "0")}</p>
                  <h2 className="mt-1 font-display text-xl leading-tight text-forest">{step.label}</h2>
                  <p className="mx-auto mt-2 max-w-[11rem] font-body text-sm leading-snug text-forest/70">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Band>

      <section aria-label="How Place and Plenty works" className="bg-parchment">
        <div className="mx-auto max-w-editorial space-y-16 px-6 py-16 md:space-y-20 md:py-24">
          {STORY.map((stage, index) => (
            <article key={stage.eyebrow} className="grid items-center gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3"><span className="h-px w-8 bg-gold" aria-hidden /><p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/75">{stage.eyebrow}</p></div>
                <h2 className="mt-4 font-display text-3xl leading-tight text-forest md:text-[2.25rem]">{stage.title}</h2>
                <p className="mt-5 font-body text-base leading-relaxed text-forest/75">{stage.body}</p>
              </div>
              <div className={`relative aspect-[16/10] overflow-hidden rounded-3xl shadow-soft ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                <Image src={stage.image} alt={stage.alt} fill className="object-cover" sizes="(min-width: 1024px) 65vw, 100vw" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
