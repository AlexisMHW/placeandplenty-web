import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import type { CommunityStory } from "@/lib/tina-content";

// Show Us How You Gather. Directive §16's governing emotional rule is
// "Your gathering counts too" — this is explicitly NOT a perfect-party
// showcase, so the copy names paper plates and mismatched chairs rather
// than styling.
//
// Every story reaching this component has already passed BOTH gates in
// lib/tina-content.ts: published, and consent confirmed. Nothing here
// re-checks that, and nothing here should be given a way to bypass it.
//
// Contributor names are shown only when the founder recorded one. A blank
// name is a real editorial choice — someone can consent to their table
// being shown without consenting to being named — so it renders as an
// unattributed story rather than falling back to anything.

export default function CommunityTeaser({
  stories,
}: {
  stories: CommunityStory[];
}) {
  return (
    <section className="bg-parchment py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Show Us How You Gather</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
              Your gathering counts too.
            </h2>
            <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
              Real homes, real tables, real people. Backyards and apartments,
              paper plates and Grandma&rsquo;s china, six people or sixty.
            </p>
          </div>

          <Link
            href="/show-us-how-you-gather"
            className="flex-shrink-0 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See how people gather &rarr;
          </Link>
        </div>

        {stories.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((story) => (
              <li key={story._sys.filename}>
                <Link
                  href={`/show-us-how-you-gather/${story._sys.filename}`}
                  className="group block h-full overflow-hidden rounded-card border border-sage/30 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
                >
                  {story.heroImage && (
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={story.heroImage}
                        alt={story.heroImageAlt || ""}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-400 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {story.gatheringType && (
                      <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/75">
                        {story.gatheringType}
                      </p>
                    )}
                    <h3 className="mt-2 font-display text-xl leading-snug text-forest">
                      {story.title}
                    </h3>
                    {story.contributorName && (
                      <p className="mt-2 font-body text-sm text-forest/60">
                        from {story.contributorName}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
