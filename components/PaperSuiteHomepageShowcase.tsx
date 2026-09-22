import Link from "next/link";
import { Display } from "@/components/Display";

const PIECES = [
  {
    title: "Invitation",
    body: "Gathering details → coordinated invitation",
    position: "0% 0%",
    alt: "A coordinated printed invitation suite",
  },
  {
    title: "Menu Card",
    body: "My Table → a menu you don’t have to retype",
    position: "100% 0%",
    alt: "An elegant printed menu card at a styled table",
  },
  {
    title: "Weekend Itinerary",
    body: "My Schedule → a printed weekend plan",
    position: "0% 100%",
    alt: "A coordinated printed multi-day weekend itinerary",
  },
  {
    title: "Welcome Sign",
    body: "Gathering identity → a ready-to-print sign",
    position: "100% 100%",
    alt: "A coordinated welcome sign for a gathering",
  },
];

export default function PaperSuiteHomepageShowcase() {
  return (
    <section className="border-y border-gold/20 bg-parchment">
      <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
        <div className="grid gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/60">
              New: My Paper Suite
            </p>
            <Display
              emphasis="Now let Place & Plenty print it."
              className="mt-4 text-3xl leading-tight text-forest md:text-[2.6rem]"
            >
              {"You already planned it. Now let Place & Plenty print it."}
            </Display>
            <p className="mt-5 max-w-2xl font-body text-base leading-relaxed text-forest/75">
              Turn the details already inside your gathering into coordinated invitations,
              menu cards, weekend itineraries, welcome pieces and thank-you cards — without
              rebuilding the plan somewhere else.
            </p>
            <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-forest/65">
              Already have an invitation? Bring it over. Match My Invitation can carry its
              color direction into the rest of your paper suite while Place &amp; Plenty keeps
              the layout print-ready.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/paper-suite"
                className="rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
              >
                See My Paper Suite
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-forest px-6 py-3 font-body text-sm font-semibold text-forest"
              >
                Start a Gathering Free
              </Link>
            </div>
            <p className="mt-4 font-body text-xs leading-relaxed text-forest/50">
              Paper Suite creation and ordering launches on the web first. It uses the same
              Place &amp; Plenty account and gathering data as the rest of the product.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PIECES.map((piece, index) => (
              <article
                key={piece.title}
                className={
                  "overflow-hidden rounded-2xl border shadow-softer " +
                  (index === 0
                    ? "border-gold/35 bg-cream"
                    : index === 1
                      ? "border-sage/30 bg-offwhite"
                      : index === 2
                        ? "border-gold/25 bg-parchment"
                        : "border-sage/25 bg-sage/15")
                }
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden" role="img" aria-label={piece.alt}>
                  <img
                    src="/images/paper-suite-card-sprite.webp"
                    alt=""
                    aria-hidden
                    className="absolute h-[200%] w-[200%] max-w-none object-cover"
                    style={{
                      left: piece.position.startsWith("100%") ? "-100%" : "0",
                      top: piece.position.endsWith("100%") ? "-100%" : "0",
                    }}
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg text-forest">{piece.title}</h3>
                    <span className="font-body text-[0.58rem] font-bold uppercase tracking-[0.14em] text-goldInk">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2 font-body text-xs leading-relaxed text-forest/68">{piece.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
