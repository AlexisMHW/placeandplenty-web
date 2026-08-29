import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import CategoryRail from "@/components/CategoryRail";
import { Band, Display } from "@/components/Display";
import { TagCard, type CardMeta } from "@/components/Cards";
import { BotanicalDivider } from "@/components/Botanical";
import { getAllGatheringIdeas, ideaCard } from "@/lib/tina-content";
import type { GatheringIdea } from "@/lib/tina-content";

// GATHERING IDEAS, composed to `Gathering_Ideas_Page.png`.
//
//   PageHero      split opening with the HOME HOSTING / MADE SIMPLE seal
//   CategoryRail  the circular category chips, with a live count each
//   THE GRID      photo-led cards with a category pill and a meta row
//   CtaBand
//
// §11 IS THE BRIEF: "This page must be a visual destination, not a
// four-link list." So the card is the work — photograph on top, a
// category pill laid over it, then the title, the deck, and a row of
// small facts that turn an inspiration card into a planning one.
//
// WHAT THE REFERENCE SHOWS THAT IS NOT BUILT, AND WHY. It draws a
// six-control filter bar — Sort by, Season, Group Size, Indoor/Outdoor,
// Prep Time, Dietary Needs — over ten cards. There are four published
// ideas. Six filters over four items is not a destination, it is
// furniture: every control would either do nothing or empty the page.
// §11 says "filters where useful", and the useful version at this size
// is the category rail, which is real, navigable, and grows into the
// full bar the moment the library does. The card's meta row carries the
// same facts the filters would sort on, so nothing is lost from the
// visitor's side.
//
// THE PHOTOGRAPH IS THE PAGE. §19: "For Gathering Ideas, every featured
// card needs relevant photography." None of the four has one yet, so
// each renders the designed plate at the identical ratio with the
// intended subject named on it — architecture built, slot reserved,
// nothing shifting when the real image lands. Every one is listed in
// PHOTOGRAPHY-MANIFEST.md.

export const metadata: Metadata = {
  title: "Gathering Ideas",
  description:
    "Reasons to have people over, and what each one could look like at your place. Real ideas, real hosts, real moments — with the menus, quantities and checklists to pull them off.",
  alternates: { canonical: "/gathering-ideas" },
  openGraph: { url: "/gathering-ideas" },
};

/**
 * The meta row on a card. Only facts the document actually carries —
 * inventing "45 min prep" to fill a row the reference shows would be
 * decorating a card with a number nobody checked.
 */
function metaFor(idea: GatheringIdea): CardMeta[] {
  const meta: CardMeta[] = [];
  if (idea.season) meta.push({ icon: "sun", label: titleCase(idea.season) });
  if (idea.occasion)
    meta.push({ icon: "cake", label: titleCase(idea.occasion) });
  // `contentType` is deliberately NOT shown. It is an editorial taxonomy
  // word — "seasonal", "evergreen" — and printing it next to the season
  // gave every card a meta row reading "Fall · Game day · seasonal",
  // where the third item tells a reader nothing they can plan around.
  return meta;
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function GatheringIdeasPage() {
  const ideas = await getAllGatheringIdeas();

  // Categories come from the content, not from a hardcoded list, so a
  // new season or occasion appears in the rail by being published rather
  // than by someone remembering to add it here.
  const counts = new Map<string, number>();
  for (const idea of ideas) {
    const key = idea.season || idea.occasion || "Evergreen";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const categories = [
    { label: "All Ideas", count: ideas.length, icon: "grid" as const },
    ...Array.from(counts.entries()).map(([label, count]) => ({
      label: titleCase(label),
      count,
      icon: "leaf" as const,
    })),
  ];

  // Grouped by season, because a visitor in October wants what is
  // happening now rather than what was posted most recently.
  const groups = new Map<string, GatheringIdea[]>();
  for (const idea of ideas) {
    const key = idea.season ? titleCase(idea.season) : "All year round";
    groups.set(key, [...(groups.get(key) ?? []), idea]);
  }

  return (
    <>
      <PageHero
        eyebrow="Gathering Ideas"
        headline="Inspiration for every kind of"
        emphasisLine="gathering."
        image={null}
        imageCaption="A laid table with greenery, candles and a hand-lettered place card reading gather"
        stamp={{ top: "Home hosting", bottom: "Made simple" }}
        body={
          <>
            <p>Real ideas. Real hosts. Real moments.</p>
            <p className="mt-3">
              Themes, menus, quantities and checklists — the practical side of
              &ldquo;what should we gather for, and what could it look like?&rdquo;
            </p>
          </>
        }
        action={
          <Link
            href="#all-ideas"
            className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Explore Ideas
          </Link>
        }
      />

      <CategoryRail
        intro="From cozy nights in to big celebrations and everything in between — there’s an idea for the gathering you’re actually having."
        categories={categories}
      />

      <Band tone="plain" id="all-ideas">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          {ideas.length === 0 ? (
            <p className="font-body text-base text-forest/70">
              New ideas are on the way.
            </p>
          ) : (
            <div className="space-y-14">
              {Array.from(groups.entries()).map(([season, list]) => (
                <section key={season} id={season.toLowerCase().replace(/\s+/g, "-")}>
                  <h2 className="flex items-center gap-4 font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/65">
                    <span aria-hidden className="h-px w-8 flex-shrink-0 bg-gold" />
                    {season}
                    <span className="font-normal normal-case tracking-normal text-forest/45">
                      {list.length} {list.length === 1 ? "idea" : "ideas"}
                    </span>
                  </h2>

                  <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {list.map((idea, i) => {
                      const card = ideaCard(idea);
                      return (
                        <li key={idea._sys.filename}>
                          <TagCard
                            href={card.href}
                            tag={idea.occasion || idea.season || null}
                            title={card.headline}
                            deck={card.deck}
                            meta={metaFor(idea)}
                            image={card.image}
                            imageAlt={card.imageAlt}
                            priority={i < 2}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <BotanicalDivider className="mt-16" />

          <div className="mt-10 text-center">
            <Display className="text-2xl leading-snug text-forest md:text-3xl">
              Love a good idea? Save it, plan it, make it yours.
            </Display>
            <p className="mx-auto mt-3 max-w-xl font-body text-base leading-relaxed text-forest/70">
              Create the gathering in Place &amp; Plenty and we&rsquo;ll help
              with the rest — the menu, the quantities, the shopping and who
              is bringing what.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
            >
              Start planning free
            </Link>
          </div>
        </div>
      </Band>

      <CtaBand
        headline="Less scrambling."
        emphasisLine="More gathering."
        body="Pick an idea, create the gathering, and let Place & Plenty carry the rest of it."
      />
    </>
  );
}
