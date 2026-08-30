import Image from "next/image";
import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import { ideaCard, type GatheringIdea } from "@/lib/tina-content";
import gameDay from "../homepage/gathering-game-day.png";
import backyardDinner from "../homepage/gathering-backyard-dinner.png";
import halloween from "../homepage/gathering-halloween-spooktacular.png";
import friendsgiving from "../homepage/gathering-friendsgiving.png";

const SEASONAL_IMAGES = [gameDay, backyardDinner, halloween, friendsgiving];

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
          <BotanicalSprig className="hidden flex-shrink-0 text-olive sm:block" size={44} />
          <Display emphasis="hosting" className="text-center text-3xl leading-tight text-forest md:text-4xl">
            Reasons people are hosting right now.
          </Display>
          <BotanicalSprig className="hidden flex-shrink-0 text-olive sm:block" size={44} flip />
        </div>

        {reasonLine && (
          <p className="mx-auto mt-5 max-w-2xl text-center font-body text-lg leading-relaxed text-forest/75">
            {reasonLine}
          </p>
        )}

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ideas.slice(0, 4).map((idea, i) => {
            const card = ideaCard(idea);
            const image = SEASONAL_IMAGES[i];
            return (
              <Link
                key={idea._sys.filename}
                href={card.href}
                className="group overflow-hidden rounded-card border border-sage/30 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={image}
                    alt={card.imageAlt || card.headline}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-400 group-hover:scale-[1.03]"
                    priority={i < 2}
                  />
                </div>
                <div className="border-t border-sage/25 p-5 text-center">
                  <h3 className="font-display text-xl leading-snug text-forest">{card.headline}</h3>
                  {card.deck && (
                    <p className="mt-2 font-body text-xs uppercase leading-relaxed tracking-[0.1em] text-forest/60">
                      {card.deck}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link href="/gathering-ideas" className="inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage">
            All Gathering Ideas <span aria-hidden>&rarr;</span>
          </Link>
        </div>
      </div>
    </Band>
  );
}
