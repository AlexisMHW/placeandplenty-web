import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import GatheringIdeaCard from "@/components/GatheringIdeaCard";
import type { GatheringIdea } from "@/lib/tina-content";

// "Reasons people are hosting right now." — §12's homepage concept, and
// the reference's second band.
//
// THE HEADING IS CENTRED AND FLANKED BY BOTANICALS, exactly as the
// reference has it, with italic emphasis on "hosting". Centring is not a
// default here: everything else on the page is left-aligned, and this is
// the one moment the page addresses the room rather than the reader.
//
// THE SEASONAL LINE SITS UNDER THE HEADING as the deck. It used to live
// in the hero; the reference puts the brand line up there and the
// seasonal reason here, which is the more durable arrangement — the
// thing that changes four times a year sits next to the cards that
// change with it.
//
// Which ideas appear is a Tina reference list (§6), so a rotation is
// four picks in the editor. Nothing about a card is typed twice: the
// headline and image come from the idea it opens.
//
// RENDERS NOTHING WHEN EMPTY. Four empty boxes would be worse than no
// section.

export default function SeasonalCards({
  ideas,
  reasonLine,
}: {
  ideas: GatheringIdea[];
  reasonLine?: string | null;
}) {
  if (ideas.length === 0) return null;

  return (
    <Band tone="cream">
      <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div className="flex items-center justify-center gap-5">
          <BotanicalSprig
            className="hidden flex-shrink-0 text-olive sm:block"
            size={44}
          />
          <Display
            emphasis="hosting"
            className="text-center text-3xl leading-tight text-forest md:text-4xl"
          >
            Reasons people are hosting right now.
          </Display>
          <BotanicalSprig
            className="hidden flex-shrink-0 text-olive sm:block"
            size={44}
            flip
          />
        </div>

        {reasonLine && (
          <p className="mx-auto mt-5 max-w-2xl text-center font-body text-lg leading-relaxed text-forest/75">
            {reasonLine}
          </p>
        )}

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ideas.map((idea, i) => (
            <GatheringIdeaCard
              key={idea._sys.filename}
              idea={idea}
              priority={i < 2}
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/gathering-ideas"
            className="inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            All Gathering Ideas
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>
    </Band>
  );
}
