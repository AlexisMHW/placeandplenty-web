import Link from "next/link";
import Photo from "@/components/Photo";
import { ideaCard, type GatheringIdea } from "@/lib/tina-content";

// A Gathering Idea card, composed to the approved reference.
//
// PHOTOGRAPH ON TOP, CAPTION IN A PANEL BELOW — not text laid over the
// image. The reference is explicit about this and it is the better
// construction for two reasons beyond taste:
//
//   1. Legibility stops depending on the photograph. Text over an image
//      needs a scrim heavy enough for the brightest photo anyone might
//      upload, which dulls every other photo to pay for it.
//   2. It degrades honestly. With no image the card is still a caption
//      panel under a botanical plate, rather than a coloured rectangle
//      pretending a photo was intended.
//
// Card imagery comes from Tina (`cardImage`, falling back to
// `heroImage`), so an idea published before its photograph is shot is a
// normal state, not an error.
//
// THE FALLBACK PLATE IS EVERGREEN. Forest with an olive sprig — not
// autumn leaves, not pumpkins. When the season rotates to winter,
// nothing about it needs changing, which is the whole point of keeping
// the seasonal layer in content and the identity in code.

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
      className="group flex h-full flex-col overflow-hidden rounded-card border border-sage/30 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
    >
      {/* NO CAPTION ON THE PLATE HERE. The headline sits directly
          beneath the image, so printing it on the plate as well read as
          the same words twice — the one place the plate's caption makes
          a card worse rather than better. The shot brief for these four
          lives in PHOTOGRAPHY-MANIFEST.md. */}
      <Photo
        src={card.image}
        alt={card.imageAlt}
        compact
        tone="forest"
        className="aspect-[4/3] w-full"
        imageClassName="transition-transform duration-400 group-hover:scale-[1.04]"
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
      />

      <div className="flex flex-1 flex-col border-t border-sage/25 p-5 text-center">
        <h3 className="font-display text-xl leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
          {card.headline}
        </h3>
        {card.deck && (
          <p className="mt-2 font-body text-xs uppercase leading-relaxed tracking-[0.1em] text-forest/60">
            {card.deck}
          </p>
        )}
      </div>
    </Link>
  );
}
