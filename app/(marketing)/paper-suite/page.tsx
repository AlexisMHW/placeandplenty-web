import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { Band, Display } from "@/components/Display";
import { FaqSchema } from "@/components/StructuredData";

export const metadata: Metadata = {
  title: "Paper Suite | Invitations, Menus, Itineraries & Thank-You Cards",
  description:
    "Turn your Place & Plenty gathering into coordinated printed invitations, menu cards, weekend itineraries, welcome signs and thank-you cards — using the plan you already built.",
  alternates: { canonical: "/paper-suite" },
  openGraph: {
    title: "My Paper Suite | Place & Plenty",
    description:
      "Create coordinated printed pieces from your gathering details, My Table and Multi-Day schedule without retyping the plan.",
    url: "/paper-suite",
  },
};

const PIECES = [
  {
    title: "Invitations",
    body: "Create a coordinated invitation from your gathering name, date, time and location — or bring the invitation artwork you already have.",
    sizes: "4 × 6 · 5 × 7 · square",
  },
  {
    title: "Details & Welcome Cards",
    body: "Turn location, timing and guest-facing notes into a companion card that stays with the invitation suite.",
    sizes: "4 × 6 · 5 × 7 · 4 × 9",
  },
  {
    title: "Menu Cards",
    body: "My Table becomes the source. Your dishes, sections and menu structure flow into a print-ready menu without entering them again.",
    sizes: "4 × 9 · 5 × 7 · A5",
  },
  {
    title: "Weekend Itineraries",
    body: "Multi-Day gatherings can turn My Schedule into a printed day-by-day plan for bachelorette weekends, reunions, wedding weekends, retreats and more.",
    sizes: "4 × 9 · 5 × 7 · A5 · 8 × 10 · A4",
  },
  {
    title: "Welcome Signs",
    body: "Use the gathering identity, date and location to create a larger welcome piece that coordinates with the rest of the suite.",
    sizes: "8 × 10 · A4",
  },
  {
    title: "Thank-You Cards",
    body: "Carry the same gathering identity into a coordinated post-gathering card with an editable thank-you message.",
    sizes: "4 × 6 · 5 × 7 · square",
  },
];

const faqs = [
  {
    q: "Do I have to re-enter my menu or itinerary?",
    a: "No. My Paper Suite reads the gathering information you already built in Place & Plenty. Menu cards can use My Table, and Multi-Day itineraries can use My Schedule.",
  },
  {
    q: "Can I use an invitation I already bought or designed?",
    a: "Yes. Upload your invitation to Place & Plenty and use Match My Invitation to carry its color direction into a controlled Place & Plenty paper layout. It coordinates the suite rather than promising an exact recreation of someone else’s artwork.",
  },
  {
    q: "Is My Paper Suite available in the mobile app?",
    a: "Paper Suite creation, print quoting and ordering are launching on the web first. The gathering data is shared across your Place & Plenty account, so the feature is designed to surface in the native app later without creating a separate paper system.",
  },
  {
    q: "Who prints and ships the stationery?",
    a: "Place & Plenty prepares the print piece and ordering flow; print fulfillment is handled through an integrated production partner after checkout.",
  },
];

export default function PaperSuiteMarketingPage() {
  return (
    <>
      <FaqSchema faqs={faqs} />

      <PageHero
        eyebrow="My Paper Suite"
        headline="The plan is already here."
        emphasisLine="Now make it tangible."
        image="/images/harding-paper-suite.webp"
        imageAlt="A coordinated Harding Family Reunion paper suite with invitation, itinerary, menu, details card, welcome sign and thank-you card"
        imageCaption="Invitation, itinerary, menu, details, welcome and thank-you pieces — all in one coordinated suite."
        unoptimizedImage
        body={
          <p>
            Invitations, menus, weekend itineraries, details cards, welcome signs and thank-you
            cards — created from the gathering you are already planning in Place &amp; Plenty.
          </p>
        }
        action={
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
          >
            Start a Gathering Free
          </Link>
        }
      />

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              Create from your gathering
            </p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.5rem]">
              No second planning system.
            </Display>
            <p className="mt-4 font-body text-base leading-relaxed text-forest/75">
              The point is not to make you design stationery from scratch. Place &amp; Plenty
              already knows the gathering. My Paper Suite turns that structured plan into a
              coordinated print piece, then lets you choose the size, design, quantity and
              fulfillment option.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PIECES.map((piece) => (
              <article key={piece.title} className="rounded-2xl border border-sage/25 bg-offwhite p-6 shadow-softer">
                <h2 className="font-display text-xl text-forest">{piece.title}</h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/72">{piece.body}</p>
                <p className="mt-5 border-t border-sage/20 pt-4 font-body text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-forest/50">
                  {piece.sizes}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
                Match My Invitation
              </p>
              <Display
                emphasis="Bring it with you."
                className="mt-4 text-3xl leading-tight text-forest md:text-[2.45rem]"
              >
                {"Already have the invitation? Bring it with you."}
              </Display>
              <p className="mt-5 font-body text-base leading-relaxed text-forest/75">
                Upload an existing invitation and let Place &amp; Plenty pull a coordinated
                color direction into the rest of your suite. You still choose from controlled
                layouts built to stay readable and print-ready.
              </p>
              <p className="mt-4 font-body text-sm leading-relaxed text-forest/62">
                This is style matching, not pixel-for-pixel recreation. That keeps the feature
                reliable across purchased invitations, flattened PDFs, screenshots and custom artwork.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["1", "Upload", "Bring in the invitation artwork already attached to your gathering."],
                ["2", "Match", "Place & Plenty reads the visual palette and coordinates the suite."],
                ["3", "Choose", "Pick one of four controlled Place & Plenty layouts."],
                ["4", "Print", "Preview, choose size and quantity, then continue to secure checkout."],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-2xl border border-gold/25 bg-cream p-5">
                  <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">{step}</p>
                  <h3 className="mt-3 font-display text-xl text-forest">{title}</h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Band>

      <Band tone="sage">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
                Web first
              </p>
              <Display className="mt-3 text-2xl text-forest md:text-3xl">
                Same gathering. Same account. A web-first print studio.
              </Display>
              <p className="mt-4 max-w-3xl font-body text-base leading-relaxed text-forest/78">
                Paper Suite creation, quoting and ordering launch on the web first because the
                larger preview and checkout flow fit naturally there. It is not a separate product:
                it reads the same canonical gathering records as the app, and the native experience
                can surface the same suite during the final mobile rebuild.
              </p>
            </div>
            <Link
              href="/signup"
              className="inline-flex rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
            >
              Start Hosting Free
            </Link>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-prose px-6 py-16 md:py-20">
          <Display className="text-2xl text-forest md:text-3xl">Paper Suite questions</Display>
          <dl className="mt-8 divide-y divide-sage/30">
            {faqs.map((item) => (
              <div key={item.q} className="py-5">
                <dt className="font-body text-base font-bold text-forest">{item.q}</dt>
                <dd className="mt-2 font-body text-base leading-relaxed text-forest/80">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Band>
    </>
  );
}
