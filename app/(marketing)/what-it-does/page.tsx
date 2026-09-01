import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { Band, Display } from "@/components/Display";
import FeatureMiniVisual from "@/components/FeatureMiniVisual";
import Icon, { type IconName } from "@/components/Icon";
import { CROSS_PLATFORM_PROMISE } from "@/lib/entitlements";
import myTable from "../../../what-it-does/what-it-does-01-my-table.png";
import hostingCloset from "../../../what-it-does/what-it-does-02-my-hosting-closet.png";
import coHosts from "../../../what-it-does/what-it-does-03-my-co-hosts.png";
import myPeople from "../../../what-it-does/what-it-does-04-my-people.png";
import musicMedia from "../../../what-it-does/what-it-does-05-my-music-media.png";
import hostMode from "../../../what-it-does/what-it-does-06-host-mode.png";
import myShopping from "../../../what-it-does/what-it-does-07-my-shopping.png";
import styleBoard from "../../../what-it-does/what-it-does-08-my-style-board.png";
import guestBook from "../../../what-it-does/what-it-does-09-my-guest-book.png";
import invitations from "../../../what-it-does/what-it-does-11-my-invitations.png";

export const metadata: Metadata = {
  title: "What It Does",
  description:
    "See the Place & Plenty home-hosting toolkit — the people, food, shopping, space, invitations, gathering day and everything that keeps the plan connected.",
  alternates: { canonical: "/what-it-does" },
  openGraph: { url: "/what-it-does" },
};

type Feature = {
  number: string;
  name: string;
  image?: StaticImageData;
  visualKind?: "contributions" | "space" | "photos";
};

const FEATURES: Feature[] = [
  { number: "01", name: "My Table", image: myTable },
  { number: "02", name: "My Hosting Closet", image: hostingCloset },
  { number: "03", name: "My Co-Hosts", image: coHosts },
  { number: "04", name: "My People", image: myPeople },
  { number: "05", name: "My Music & Media", image: musicMedia },
  { number: "06", name: "Host Mode", image: hostMode },
  { number: "07", name: "My Shopping", image: myShopping },
  { number: "08", name: "My Style Board", image: styleBoard },
  { number: "09", name: "My Guest Book", image: guestBook },
  { number: "10", name: "Who’s Bringing What", visualKind: "contributions" },
  { number: "11", name: "My Invitations", image: invitations },
  { number: "12", name: "Space Mode", visualKind: "space" },
  { number: "13", name: "My Gathering Photos", visualKind: "photos" },
];

const CONNECTED: { name: string; icon: IconName; body: string }[] = [
  {
    name: "HostReady Score",
    icon: "gauge",
    body: "A live view of how prepared your gathering is, based on what has been decided and what is still open.",
  },
  {
    name: "Next Up",
    icon: "arrow",
    body: "Surfaces the next useful things to handle instead of asking you to stare at the whole plan at once.",
  },
  {
    name: "Figure It Out",
    icon: "sparkle",
    body: "AI-assisted planning help when you want ideas or need the pieces of the gathering to make more sense together.",
  },
  {
    name: "Find Help",
    icon: "search",
    body: "A practical path to the outside help a gathering may need, from rentals and food to childcare, entertainment and other services.",
  },
  {
    name: "Weather Contingency",
    icon: "sun",
    body: "Keeps an eye on the gathering context so an outdoor plan can have a backup before the weather becomes the emergency.",
  },
  {
    name: "Budget inside My Shopping",
    icon: "cart",
    body: "Keeps spending context close to the list so the shopping plan and the money do not become two separate systems.",
  },
  {
    name: "Gather Again",
    icon: "arrow",
    body: "Starts a new gathering from a previous one without repurposing the original gathering or erasing its history.",
  },
  {
    name: "Guest Communications",
    icon: "chat",
    body: "Keeps gathering updates connected to the people who need them instead of scattering the conversation across unrelated threads.",
  },
  {
    name: "RSVP Tracking",
    icon: "rsvp",
    body: "Responses stay tied to the gathering and feed the people side of the plan as guests reply.",
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
            Place &amp; Plenty keeps the real moving pieces of home hosting connected — from the people and the food to the shopping, space, invitations and gathering day.
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
              The places your gathering lives.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/70">
              Each feature has a job. Together, they keep you from rebuilding the same gathering in five different places.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <article
                key={feature.number}
                className="overflow-hidden rounded-2xl border border-sage/20 bg-offwhite shadow-softer"
              >
                {feature.image ? (
                  <Image
                    src={feature.image}
                    alt={`${feature.name} Place & Plenty feature card`}
                    className="h-auto w-full"
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    priority={feature.number === "01"}
                  />
                ) : feature.visualKind ? (
                  <FeatureMiniVisual kind={feature.visualKind} number={feature.number} />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
                Everything Works Together
              </p>
              <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
                The useful parts that connect the whole plan.
              </Display>
              <p className="mt-5 font-body text-base leading-relaxed text-forest/75">
                These are not extra photo cards. They are the intelligence, continuity and utility that work across the rest of Place &amp; Plenty.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {CONNECTED.map((item) => (
                <li key={item.name} className="rounded-2xl border border-sage/25 bg-offwhite p-6 shadow-softer">
                  <Icon name={item.icon} size={24} className="text-forest/70" />
                  <h3 className="mt-4 font-display text-xl text-forest">{item.name}</h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      <Band tone="sage">
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
