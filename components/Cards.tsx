import Link from "next/link";
import type { ReactNode } from "react";
import Photo from "@/components/Photo";
import Icon, { type IconName } from "@/components/Icon";

// THE THREE CARDS THE REFERENCES USE, and they are genuinely three
// different objects rather than one card with options.
//
//   SplitCard      icon + copy on the left, photograph on the right.
//                  How It Works' "Everything you need" grid and What It
//                  Does' twelve-card Hub. The photograph is a SLIVER of
//                  the card, not its subject — it gives the card warmth
//                  without competing with the label.
//
//   EditorialCard  photograph on top, category / serif title / deck /
//                  Read More below. The Coordinated Host grid and the
//                  home page's article rail. This is a magazine card and
//                  the photograph is the subject.
//
//   TagCard        photograph on top with a category pill laid on it,
//                  then title, deck and a meta row of small facts.
//                  Gathering Ideas. The meta row is what turns an
//                  inspiration card into a planning one — group size,
//                  indoors or out, how long the prep takes.
//
// ALL THREE DEGRADE THE SAME WAY. With no photograph they render the
// designed plate from components/Photo.tsx at the identical aspect
// ratio, so nothing on the page moves when real photography arrives.
// Each one passes a `photoCaption` describing the picture that belongs
// there, which is also what feeds PHOTOGRAPHY-MANIFEST.md.

/* ------------------------------------------------------------------ */

export function SplitCard({
  icon,
  title,
  body,
  image,
  imageAlt,
  photoCaption,
  href,
}: {
  icon: IconName;
  title: string;
  body: string;
  image?: string | null;
  imageAlt?: string | null;
  photoCaption?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Icon name={icon} size={22} className="mt-0.5 flex-shrink-0 text-forest/70" />
          <h3 className="font-display text-lg leading-snug text-forest">
            {title}
          </h3>
        </div>
        <p className="mt-2.5 font-body text-sm leading-relaxed text-forest/70">
          {body}
        </p>
      </div>

      {/* The photograph is a SLIVER of the card, not its subject — the
          reference gives it about 38% and lets the label lead. Too narrow
          for a caption, so the plate runs on linework alone; the shot
          brief lives in lib/features.ts and the manifest instead. */}
      <Photo
        src={image}
        alt={imageAlt}
        caption={photoCaption}
        tone="sage"
        compact
        className="hidden w-[38%] flex-shrink-0 sm:block"
        sizes="(min-width: 1024px) 18vw, 38vw"
      />
    </>
  );

  const shell =
    "group flex h-full overflow-hidden rounded-2xl border border-sage/25 bg-parchment shadow-softer transition-shadow duration-400 hover:shadow-soft";

  return href ? (
    <Link href={href} className={shell}>
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  );
}

/* ------------------------------------------------------------------ */

export function EditorialCard({
  href,
  kicker,
  title,
  deck,
  image,
  imageAlt,
  photoCaption,
  action = "Read More",
  priority = false,
}: {
  href: string;
  /** Category or franchise, in letterspaced small caps. */
  kicker?: string | null;
  title: string;
  deck?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  photoCaption?: string;
  action?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sage/25 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
    >
      <Photo
        src={image}
        alt={imageAlt}
        caption={photoCaption}
        tone="forest"
        className="aspect-[16/10] w-full"
        imageClassName="transition-transform duration-400 group-hover:scale-[1.03]"
        sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw"
        priority={priority}
      />

      <div className="flex flex-1 flex-col p-5">
        {kicker && (
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
            {kicker}
          </p>
        )}
        <h3 className="mt-2 font-display text-xl leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
          {title}
        </h3>
        {deck && (
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
            {deck}
          </p>
        )}
        <span className="mt-auto pt-4 font-body text-xs font-semibold text-forest/75 underline decoration-gold decoration-2 underline-offset-4">
          {action} <span aria-hidden>&rarr;</span>
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */

export interface CardMeta {
  icon: IconName;
  label: string;
}

export function TagCard({
  href,
  tag,
  title,
  deck,
  meta,
  image,
  imageAlt,
  photoCaption,
  priority = false,
}: {
  href: string;
  tag?: string | null;
  title: string;
  deck?: string | null;
  /** Two or three short facts. More than three and none of them read. */
  meta?: CardMeta[];
  image?: string | null;
  imageAlt?: string | null;
  photoCaption?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-sage/25 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
    >
      <div className="relative">
        {/* compact: the title sits directly beneath, so a caption on the
            plate printed the same words twice. The shot briefs live in
            PHOTOGRAPHY-MANIFEST.md instead. */}
        <Photo
          src={image}
          alt={imageAlt}
          caption={photoCaption}
          compact={!photoCaption}
          tone="forest"
          className="aspect-[4/3] w-full"
          imageClassName="transition-transform duration-400 group-hover:scale-[1.03]"
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 45vw, 100vw"
          priority={priority}
        />
        {tag && (
          <span className="absolute left-3 top-3 rounded-md bg-forest/90 px-2.5 py-1 font-body text-[0.6rem] font-bold uppercase tracking-[0.14em] text-offwhite backdrop-blur-sm">
            {tag}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
          {title}
        </h3>
        {deck && (
          <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
            {deck}
          </p>
        )}

        {meta && meta.length > 0 && (
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sage/20 pt-3">
            {meta.map((m) => (
              <li
                key={m.label}
                className="flex items-center gap-1.5 font-body text-xs text-forest/60"
              >
                <Icon name={m.icon} size={14} className="flex-shrink-0" />
                {m.label}
              </li>
            ))}
          </ul>
        )}

        <span className="mt-auto pt-4 font-body text-xs font-semibold text-forest/75 underline decoration-gold decoration-2 underline-offset-4">
          View Idea <span aria-hidden>&rarr;</span>
        </span>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The horizontal featured card that straddles the hero on The
 * Coordinated Host — photograph left, the story's whole billing right.
 * One per page, always the lead.
 */
export function FeatureLede({
  href,
  eyebrow = "Featured",
  title,
  deck,
  meta,
  image,
  imageAlt,
  photoCaption,
  children,
}: {
  href: string;
  eyebrow?: string;
  title: string;
  deck?: string | null;
  meta?: ReactNode;
  image?: string | null;
  imageAlt?: string | null;
  photoCaption?: string;
  children?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-sage/25 bg-offwhite shadow-soft md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Photo
        src={image}
        alt={imageAlt}
        caption={photoCaption}
        tone="forest"
        className="aspect-[4/3] w-full md:aspect-auto md:h-full"
        sizes="(min-width: 768px) 40vw, 100vw"
        priority
      />

      <div className="relative flex flex-col justify-center p-7 md:p-10">
        <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.22em] text-forest/55">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-display text-2xl leading-tight text-forest md:text-[2.1rem]">
          {title}
        </h2>
        {deck && (
          <p className="mt-3 max-w-prose font-body text-base leading-relaxed text-forest/75">
            {deck}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {meta}
          <Link
            href={href}
            className="font-body text-sm font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-sage"
          >
            Read the Story <span aria-hidden>&rarr;</span>
          </Link>
        </div>

        {children}
      </div>
    </article>
  );
}
