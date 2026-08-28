import Link from "next/link";
import Image from "next/image";
import { BotanicalCorner } from "@/components/Botanical";
import { ideaCard, type GatheringIdea } from "@/lib/tina-content";

// A photo-led Gathering Idea card. §12/§13: the seasonal cards are
// photographic and link to Gathering Ideas — never to The Coordinated
// Host.
//
// THE NO-PHOTO CASE IS A DESIGN, NOT A BROKEN IMAGE.
//
// Card imagery comes from Tina (`cardImage`, falling back to
// `heroImage`), so at any moment a real idea may have no photograph
// behind it yet — the normal state for a freshly written piece, not an
// error. The fallback is a deep forest panel with the headline in the
// display serif, a gold rule, and a botanical sprig in the corner.
//
// The sprig matters here more than anywhere else on the site. A card
// with no image and no texture is a coloured rectangle, and four of them
// in a row is exactly the "generic cream/green SaaS composition" the
// brand rules out. The botanical is what keeps an un-photographed card
// reading as Place & Plenty rather than as a placeholder.
//
// It is EVERGREEN, not seasonal: an olive sprig, not autumn leaves. When
// the founder uploads real fall photography the sprig disappears behind
// it, and when the season rotates to winter nothing about the fallback
// needs to change.
//
// Real photography is still the goal — the visual system wants real
// homes, real tables, warm natural light. This exists so that goal is
// never a blocker to publishing.

export default function GatheringIdeaCard({
  idea,
  priority = false,
}: {
  idea: GatheringIdea;
  /** Set on the first card or two; they are usually above the fold. */
  priority?: boolean;
}) {
  const card = ideaCard(idea);

  return (
    <Link
      href={card.href}
      className="group relative flex min-h-[19rem] flex-col justify-end overflow-hidden rounded-card border border-sage/30 bg-forest shadow-softer transition-shadow duration-400 hover:shadow-lift"
    >
      {card.image ? (
        <>
          <Image
            src={card.image}
            alt={card.imageAlt}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-400 group-hover:scale-[1.03]"
            priority={priority}
          />
          {/* Carries the text, so it is part of the contrast calculation:
              forest at 90% under the caption keeps offwhite well above
              AA even over a bright photograph. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/45 to-forest/5"
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-forest via-forest to-sage/40"
          />
          <BotanicalCorner
            className="-right-4 -top-4 text-offwhite"
            size={150}
          />
        </>
      )}

      <div className="relative p-6">
        <span aria-hidden className="mb-3 block h-px w-8 bg-gold" />
        <h3 className="font-display text-2xl leading-snug text-offwhite">
          {card.headline}
        </h3>
        {card.deck && (
          <p className="mt-2 font-body text-sm leading-relaxed text-offwhite/75">
            {card.deck}
          </p>
        )}
        <span className="mt-4 inline-flex items-center gap-1.5 font-body text-xs font-bold uppercase tracking-[0.15em] text-offwhite/90">
          Get the idea
          <span
            aria-hidden
            className="transition-transform duration-400 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </span>
      </div>
    </Link>
  );
}
