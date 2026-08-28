import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import GatheringIdeaCard from "@/components/GatheringIdeaCard";
import type { GatheringIdea } from "@/lib/tina-content";

// The seasonal gathering cards. Directive §12 fixes three things about
// them and §35 says none is reopened:
//
//   - they are the launch-season reasons to gather, chosen by the founder
//   - they are photo-led
//   - they link to GATHERING IDEAS, never to The Coordinated Host
//
// Which ideas appear is a Tina reference list, so a seasonal rotation —
// fall to holiday to January — is four picks in the editor rather than a
// code change (§13). Nothing about a card is typed twice: the headline
// and image come from the idea it points at, so a card and the page it
// opens cannot disagree.
//
// RENDERS NOTHING WHEN EMPTY. A published-but-unreferenced state is
// normal early on, and four empty boxes would be worse than no section.

export default function SeasonalCards({
  ideas,
}: {
  ideas: GatheringIdea[];
}) {
  if (ideas.length === 0) return null;

  return (
    <section className="bg-offwhite py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>What people are hosting</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
              Ideas for the gatherings actually on your calendar.
            </h2>
          </div>

          <Link
            href="/gathering-ideas"
            className="flex-shrink-0 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            All Gathering Ideas &rarr;
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ideas.map((idea, i) => (
            <GatheringIdeaCard
              key={idea._sys.filename}
              idea={idea}
              priority={i < 2}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
