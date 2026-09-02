import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "What It Does",
  description:
    "See the Place & Plenty home-hosting toolkit — the people, food, shopping, space, invitations, gathering day and everything that keeps the plan connected.",
  alternates: { canonical: "/what-it-does" },
  openGraph: { url: "/what-it-does" },
};

type Feature = {
  name: string;
  image: string;
};

const FEATURES: Feature[] = [
  { name: "My Table", image: "/images/what-it-does-my-table.png" },
  { name: "My People", image: "/images/what-it-does-my-people.png" },
  { name: "My Shopping", image: "/images/what-it-does-my-shopping.png" },
  {
    name: "Who’s Bringing What",
    image: "/images/what-it-does-whos-bringing-what.png",
  },
  {
    name: "My Hosting Closet",
    image: "/images/what-it-does-my-hosting-closet.png",
  },
  {
    name: "My Music & Media",
    image: "/images/what-it-does-my-music-media.png",
  },
  {
    name: "My Style Board",
    image: "/images/what-it-does-my-style-board.png",
  },
  { name: "Space Mode", image: "/images/what-it-does-space-mode.png" },
  {
    name: "My Co-Hosts",
    image: "/images/what-it-does-my-co-hosts.png",
  },
  { name: "Host Mode", image: "/images/what-it-does-host-mode.png" },
  { name: "Find Help", image: "/images/what-it-does-find-help.png" },
  {
    name: "My Gathering Photos",
    image: "/images/what-it-does-my-gathering-photos.png",
  },
];

const PLANNING_FLOW: { name: string; icon: IconName; body: string }[] = [
  {
    name: "Figure It Out",
    icon: "sparkle",
    body: "Start with AI-assisted help when you need ideas, quantities, direction, or help making the pieces of the gathering make sense together.",
  },
  {
    name: "Budget",
    icon: "cart",
    body: "Keep what you need to buy and what you are spending together inside My Shopping, instead of building a second money system somewhere else.",
  },
  {
    name: "HostReady™",
    icon: "gauge",
    body: "See a live readiness score based on what is actually settled and what still needs attention before people arrive.",
  },
  {
    name: "Next Up",
    icon: "arrow",
    body: "Let Place & Plenty surface the next useful thing to handle so the whole plan does not have to live in your head at once.",
  },
  {
    name: "Weather Contingency",
    icon: "sun",
    body: "Keep an eye on the forecast and connect a Plan B to the gathering before weather becomes a last-minute emergency.",
  },
  {
    name: "Gather Again",
    icon: "arrow",
    body: "Use a gathering that worked as the starting point for a new one without repurposing the original or losing its history.",
  },
];

const GUEST_LOOP: { name: string; icon: IconName; body: string }[] = [
  {
    name: "Invitations",
    icon: "envelope",
    body: "Send a Place & Plenty invitation or bring the artwork you already have.",
  },
  {
    name: "RSVP Tracking",
    icon: "rsvp",
    body: "Responses, attendance and guest details stay connected to the gathering as people reply.",
  },
  {
    name: "Guest Communications",
    icon: "chat",
    body: "Send gathering updates to the people who need them without reconstructing the guest list in a separate group chat.",
  },
  {
    name: "My Guest Book",
    icon: "book",
    body: "Keep the people you host most often in one reusable account-level place for the next gathering too.",
  },
];

export default function WhatItDoesPage() {
  return (
    <>
      <section className="bg-cream">
        <div className="mx-auto max-w-editorial px-6 py-20 text-center md:py-24">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">
            What It Does
          </p>
          <Display
            as="h1"
            emphasis="one place"
            className="mx-auto mt-5 max-w-4xl text-4xl leading-tight text-forest sm:text-5xl md:text-6xl"
          >
            Everything you need. All in one place.
          </Display>
          <p className="mx-auto mt-6 max-w-2xl font-body text-lg leading-relaxed text-forest/75">
            Place &amp; Plenty keeps the real moving pieces of home hosting connected — from the people and the food to the shopping, space and gathering day.
          </p>
          <Link
            href="#features"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
          >
            Explore the Features
          </Link>
        </div>
      </section>

      <Band tone="parchment" id="features">
        <div className="mx-auto max-w-[88rem] px-5 py-14 sm:px-6 md:py-18">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              The toolkit
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              The tools behind a put-together get-together.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/70">
              Each has a job. Together, they keep the people, food, shopping, space, help and gathering day connected.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.name}
                className="overflow-hidden rounded-2xl border border-sage/20 bg-offwhite shadow-softer"
              >
                <Image
                  src={feature.image}
                  alt={`${feature.name} — Place & Plenty home-hosting feature`}
                  width={1024}
                  height={1024}
                  className="h-auto w-full"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  priority={index < 4}
                />
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Everything Works Together
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              Smart help from “people are coming” to gathering again.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
              The cards above are where you work. This is the intelligence and continuity running through the plan as the gathering moves forward.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PLANNING_FLOW.map((item, index) => (
              <li
                key={item.name}
                className="relative rounded-2xl border border-sage/25 bg-offwhite p-6 shadow-softer"
              >
                <div className="flex items-center justify-between gap-4">
                  <Icon name={item.icon} size={24} className="text-forest/70" />
                  <span className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-gold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl text-forest">{item.name}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              The Guest Loop
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.35rem]">
              Bring in your people. Keep the details with them.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
              Invitations → RSVPs → communications → the people worth gathering with again.
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GUEST_LOOP.map((item) => (
              <li key={item.name} className="rounded-2xl border border-forest/10 bg-offwhite/80 p-6">
                <Icon name={item.icon} size={24} className="text-forest/70" />
                <h3 className="mt-4 font-display text-lg text-forest">{item.name}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-8 max-w-2xl text-center font-display text-xl italic leading-relaxed text-forest">
            Got your own invitations? Bring them over — yeah, we handle that too.
          </p>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid items-center gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <div className="flex gap-3 text-forest/70">
              <Icon name="laptop" size={40} />
              <Icon name="phone" size={40} />
            </div>
            <div>
              <h2 className="font-display text-2xl leading-snug text-forest md:text-[1.75rem]">
                One account. Web + mobile.
              </h2>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/75">
                {CROSS_PLATFORM_PROMISE}
              </p>
              <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-forest/65">
                Host Mode and Space Mode stay naturally phone-first because one belongs with you on gathering day and the other begins with your camera. The rest of the plan stays connected around them.
              </p>
            </div>
          </div>
        </div>
      </Band>
    </>
  );
}
