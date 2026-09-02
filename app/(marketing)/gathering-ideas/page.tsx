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

export const metadata: Metadata = {
  title: "Gathering Ideas",
  description:
    "Reasons to have people over, and what each one could look like at your place. Real ideas, real hosts, real moments — with the menus, quantities and checklists to pull them off.",
  alternates: { canonical: "/gathering-ideas" },
  openGraph: { url: "/gathering-ideas" },
};

function metaFor(idea: GatheringIdea): CardMeta[] {
  const meta: CardMeta[] = [];
  if (idea.season) meta.push({ icon: "sun", label: titleCase(idea.season) });
  if (idea.occasion)
    meta.push({ icon: "cake", label: titleCase(idea.occasion) });
  return meta;
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function GatheringIdeasPage() {
  const ideas = await getAllGatheringIdeas();

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
        image="/images/ChatGPT Image Sep 1, 2026, 08_05_59 PM (6).png"
        imageAlt="A warm home table set for an inviting gathering"
        imageCaption="Ideas for the gatherings people are actually having — seasonal, everyday and worth doing."
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
