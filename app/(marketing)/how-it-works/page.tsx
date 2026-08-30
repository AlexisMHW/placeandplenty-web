import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import FounderBand from "@/components/FounderBand";
import CtaBand from "@/components/CtaBand";
import Photo from "@/components/Photo";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalDivider } from "@/components/Botanical";
import { PROMISE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "From people are coming to come on in. See how Place & Plenty supports the real hosting journey from first details through gathering day.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { url: "/how-it-works" },
};

type JourneyStage = {
  number: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  primaryCaption: string;
  secondaryCaption?: string;
  tone: "cream" | "parchment";
};

const JOURNEY: JourneyStage[] = [
  {
    number: "01",
    icon: "check",
    eyebrow: "Start the gathering",
    title: "Give the gathering a place to begin.",
    body: "Start with the basics — what you’re hosting, when it’s happening, where people are coming, and roughly how many people you expect. Place & Plenty turns those first details into the gathering everything else connects to.",
    bullets: [
      "Date, time and location",
      "Gathering type and basic details",
      "Starting guest count",
      "One gathering record across web and mobile",
    ],
    primaryCaption:
      "Place & Plenty Create Gathering screen with date, time, location and guest-count fields",
    tone: "cream",
  },
  {
    number: "02",
    icon: "envelope",
    eyebrow: "Bring in your people",
    title: "Invite them your way. Keep the people part connected.",
    body: "Send a Place & Plenty invitation or bring the invitation you already made. RSVPs feed the same gathering, My People keeps this guest list organised, and the people you host repeatedly can live in My Guest Book for next time.",
    bullets: [
      "Invitations — ours or yours",
      "RSVP tracking",
      "My People for this gathering",
      "Reusable people in My Guest Book",
    ],
    primaryCaption:
      "Place & Plenty Invitations screen on web and mobile with RSVP summary",
    secondaryCaption:
      "My People guest list showing RSVP status, household details and guest notes",
    tone: "parchment",
  },
  {
    number: "03",
    icon: "table",
    eyebrow: "Plan the food",
    title: "Build the menu around the people you’re actually feeding.",
    body: "Plan dishes in My Table, account for serving counts and dietary needs, and use Figure It Out For Me when you want help making the pieces make sense together.",
    bullets: [
      "My Table menu planning",
      "Serving counts",
      "Allergies and dietary needs",
      "Figure It Out For Me guidance",
    ],
    primaryCaption:
      "My Table screen showing menu sections, dishes, serving counts and dietary notes",
    tone: "cream",
  },
  {
    number: "04",
    icon: "gift",
    eyebrow: "Share the load",
    title: "Let people help without running the gathering from a group chat.",
    body: "Track what guests are bringing, see what is still uncovered, and invite co-hosts when someone else needs to help manage the plan — without losing one source of truth.",
    bullets: [
      "Who’s Bringing What",
      "Contribution status",
      "My Co-Hosts",
      "Shared visibility without duplicate planning",
    ],
    primaryCaption:
      "Who’s Bringing What screen showing guests, contribution items and status without food-photo thumbnails",
    secondaryCaption:
      "My Co-Hosts screen showing invited co-hosts and shared gathering access",
    tone: "parchment",
  },
  {
    number: "05",
    icon: "cart",
    eyebrow: "Know what you need",
    title: "Shop from the plan — and from what you already own.",
    body: "My Shopping gathers what the gathering needs. My Hosting Closet helps you check the glasses, platters, linens, serving pieces and décor already in your house before another thing goes into the cart.",
    bullets: [
      "My Shopping list and spending",
      "Budget visibility",
      "My Hosting Closet inventory",
      "Fewer duplicate purchases",
    ],
    primaryCaption:
      "My Shopping screen with organised grocery and supply categories plus budget context",
    secondaryCaption:
      "My Hosting Closet screen beside a real hosting cabinet with matching glassware, linens and serving pieces",
    tone: "cream",
  },
  {
    number: "06",
    icon: "grid",
    eyebrow: "Get the space ready",
    title: "Make the house work for the gathering you’re actually having.",
    body: "Use Space Mode to think through layout and flow, My Style Board to keep the look together, and Find Help when the gathering needs something outside your own four walls.",
    bullets: [
      "Space Mode",
      "My Style Board",
      "Find Help",
      "Real-life flow, seating and setup",
    ],
    primaryCaption:
      "Space Mode screen using a real room photo to suggest gathering-specific layout and flow",
    secondaryCaption:
      "Candid gathering scene with guests naturally clustering around a kitchen island while nearby seating remains open",
    tone: "parchment",
  },
  {
    number: "07",
    icon: "heart",
    eyebrow: "Get ready for the day",
    title: "Know what matters now — and what can wait.",
    body: "HostReady shows how prepared the gathering is. Next Up surfaces the most useful actions. When gathering day arrives, Host Mode helps simplify the view so you can stop managing everything at once.",
    bullets: [
      "HostReady score",
      "Next Up priorities",
      "Weather contingency when relevant",
      "Host Mode for gathering day",
    ],
    primaryCaption:
      "Gathering Overview with HostReady score, Next Up actions and current gathering details",
    secondaryCaption:
      "Host Mode screen showing a simplified gathering-day view",
    tone: "cream",
  },
  {
    number: "08",
    icon: "book",
    eyebrow: "Gather — and keep what matters",
    title: "The gathering ends. Your hosting life doesn’t start over.",
    body: "Keep gathering photos, keep the people you host most often, and use Gather Again when the next version of a gathering deserves a head start instead of a blank page.",
    bullets: [
      "My Gathering Photos",
      "My Guest Book",
      "Gather Again",
      "A history that makes the next gathering easier",
    ],
    primaryCaption:
      "My Gathering Photos and My Guest Book screens showing saved gathering memories and reusable people",
    secondaryCaption:
      "Gather Again action creating a new gathering from a previous one without repurposing the original",
    tone: "parchment",
  },
];

const JOURNEY_LABELS = [
  "Start",
  "People",
  "Food",
  "Share",
  "Shop",
  "Space",
  "Ready",
  "Remember",
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How It Works"
        headline="From ‘people are coming’"
        emphasisLine="to ‘come on in.’"
        imageCaption="A relaxed real-home gathering table being finished before guests arrive — warm light, everyday serving pieces, not formal"
        image={null}
        body={
          <>
            <p>{PROMISE}</p>
            <p className="mt-3">
              Place &amp; Plenty follows the way hosting actually unfolds —
              people, food, shopping, space, help, readiness, and the day
              itself — without making you rebuild the plan in five different
              places.
            </p>
          </>
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

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-12 md:py-14">
          <p className="text-center font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/55">
            The hosting journey
          </p>
          <ol className="mt-7 grid grid-cols-4 gap-x-3 gap-y-6 md:grid-cols-8 md:gap-4">
            {JOURNEY_LABELS.map((label, i) => (
              <li key={label} className="text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-sage/30 bg-offwhite font-display text-sm text-forest shadow-softer">
                  {i + 1}
                </span>
                <span className="mt-2 block font-body text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-forest/65">
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Band>

      <section aria-label="How Place and Plenty follows the hosting journey">
        {JOURNEY.map((stage, index) => {
          const reverse = index % 2 === 1;
          const ground = stage.tone === "cream" ? "bg-cream" : "bg-parchment";

          return (
            <div key={stage.number} className={ground}>
              <div className="mx-auto grid max-w-editorial gap-10 px-6 py-16 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
                <div className={reverse ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm text-gold">{stage.number}</span>
                    <Icon name={stage.icon} size={19} className="text-forest/65" />
                    <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.22em] text-forest/60">
                      {stage.eyebrow}
                    </p>
                  </div>

                  <Display
                    as="h2"
                    className="mt-5 text-3xl leading-tight text-forest md:text-[2.5rem]"
                  >
                    {stage.title}
                  </Display>

                  <p className="mt-5 max-w-prose font-body text-base leading-relaxed text-forest/75">
                    {stage.body}
                  </p>

                  <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                    {stage.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 font-body text-sm leading-relaxed text-forest/70"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-gold" />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  {stage.number === "02" && (
                    <div className="mt-8 rounded-2xl border border-sage/25 bg-offwhite/70 p-5 shadow-softer">
                      <p className="font-display text-xl leading-snug text-forest">
                        Got your own invitations? Bring them over. Yeah, we
                        handle that too.
                      </p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                        Place &amp; Plenty begins with the gathering — not with
                        forcing you to remake an invitation you already love.
                      </p>
                    </div>
                  )}
                </div>

                <div className={reverse ? "lg:order-1" : ""}>
                  <div className="relative">
                    <Photo
                      src={null}
                      alt={null}
                      caption={stage.primaryCaption}
                      tone={index % 2 === 0 ? "forest" : "sage"}
                      className="aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-soft"
                      sizes="(min-width: 1024px) 46vw, 100vw"
                    />

                    {stage.secondaryCaption && (
                      <Photo
                        src={null}
                        alt={null}
                        caption={stage.secondaryCaption}
                        tone="sage"
                        compact
                        className="absolute -bottom-7 right-3 hidden aspect-[4/3] w-[42%] overflow-hidden rounded-2xl border-4 border-offwhite shadow-soft md:block"
                        sizes="22vw"
                      />
                    )}
                  </div>
                </div>
              </div>

              {index < JOURNEY.length - 1 && (
                <div className="mx-auto max-w-editorial px-6">
                  <BotanicalDivider />
                </div>
              )}
            </div>
          );
        })}
      </section>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 text-center md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
            Want the feature-by-feature view?
          </p>
          <Display className="mx-auto mt-4 max-w-3xl text-3xl leading-tight text-forest md:text-[2.5rem]">
            How It Works follows the gathering. What It Does shows you the
            whole toolkit.
          </Display>
          <Link
            href="/what-it-does"
            className="mt-7 inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
          >
            Explore What It Does
          </Link>
        </div>
      </Band>

      <FounderBand />

      <CtaBand
        headline="From ‘people are coming’"
        emphasisLine="to ‘come on in.’"
        body="Start free in the browser, keep the whole gathering connected, and bring the app with you when it matters."
      />
    </>
  );
}
