import Link from "next/link";
import { Display } from "@/components/Display";

const PIECES = [
  ["Invitation", "Gathering details → coordinated invitation"],
  ["Menu Card", "My Table → a menu you don’t have to retype"],
  ["Weekend Itinerary", "My Schedule → a printed weekend plan"],
  ["Welcome Sign", "Gathering identity → a ready-to-print sign"],
];

export default function PaperSuiteHomepageShowcase() {
  return (
    <section className="border-y border-gold/20 bg-parchment">
      <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
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
            {PIECES.map(([title, body], index) => (
              <article
                key={title}
                className={
                  "min-h-[12rem] rounded-2xl border p-5 shadow-softer " +
                  (index === 0
                    ? "border-gold/35 bg-cream"
                    : index === 1
                      ? "border-sage/30 bg-offwhite"
                      : index === 2
                        ? "border-gold/25 bg-parchment"
                        : "border-sage/25 bg-sage/15")
                }
              >
                <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.16em] text-goldInk">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-5 font-display text-xl text-forest">{title}</h3>
                <div className="mt-3 h-px w-10 bg-gold/55" />
                <p className="mt-4 font-body text-sm leading-relaxed text-forest/68">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
