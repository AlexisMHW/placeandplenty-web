import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CtaBand from "@/components/CtaBand";
import { Band, Display } from "@/components/Display";
import hero from "../../../how-it-works/how-it-works-hero.png";
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

const STORY = [
  {
    eyebrow: "Plan with confidence",
    title: "Start with the gathering. Let everything connect from there.",
    body: "People, food, shopping, contributions, what you already own and what still needs doing stay tied to the same gathering instead of living in separate lists and group chats.",
    image: planWithConfidence,
    alt: "Place & Plenty planning experience showing the connected pieces of a home gathering.",
  },
  {
    eyebrow: "Ready for the day",
    title: "Know what matters now — and what can wait.",
    body: "HostReady, Next Up and Host Mode turn the plan into useful next steps as the gathering gets closer, so the day itself feels less like managing a project and more like welcoming people in.",
    image: readyForTheDay,
    alt: "Place & Plenty gathering-day experience with readiness and next-step guidance.",
  },
  {
    eyebrow: "One connected experience",
    title: "Plan on the web. Carry it with you on your phone.",
    body: "Your gathering stays on the same account across web and mobile. Sit down to plan when you want the bigger screen, then take the useful parts with you when you are shopping, setting up or hosting.",
    image: connectedExperience,
    alt: "Place & Plenty web and mobile experience shown together.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-editorial px-6 py-8 md:py-10">
          <Image
            src={hero}
            alt="How Place & Plenty works, from planning to gathering day."
            className="h-auto w-full rounded-[2rem] shadow-soft"
            priority
            sizes="(min-width: 1200px) 1200px, 100vw"
          />
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90">
              Start Hosting Free
            </Link>
            <Link href="/what-it-does" className="inline-flex items-center justify-center rounded-lg border border-forest/25 bg-offwhite/70 px-6 py-3 font-body text-sm font-semibold text-forest transition-colors duration-300 hover:bg-offwhite">
              See What It Does
            </Link>
          </div>
        </div>
      </section>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 text-center md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">The hosting journey</p>
          <Display className="mx-auto mt-4 max-w-3xl text-3xl leading-tight text-forest md:text-[2.5rem]">
            One gathering. One connected plan. Less scrambling between the pieces.
          </Display>
        </div>
      </Band>

      <section aria-label="How Place and Plenty works" className="bg-parchment">
        <div className="mx-auto max-w-editorial space-y-16 px-6 py-16 md:space-y-20 md:py-20">
          {STORY.map((stage, index) => (
            <article key={stage.eyebrow} className="grid items-center gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
              <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">{stage.eyebrow}</p>
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

      <CtaBand
        headline="From ‘people are coming’"
        emphasisLine="to ‘come on in.’"
        body="Start free in the browser, keep the whole gathering connected, and bring the app with you when it matters."
      />
    </>
  );
}
