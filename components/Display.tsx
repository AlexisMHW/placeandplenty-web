import type { ReactNode } from "react";

// TYPOGRAPHIC PRIMITIVES from the approved home page reference.
//
// THE SIGNATURE MOVE IS ITALIC EMPHASIS ON ONE WORD. The reference does
// it three times and it is what makes the type feel authored rather than
// set: "Made *Simple*", "Reasons people are *hosting* right now", "*Got
// your own invitations?*". One word, in the display serif's italic, in
// the middle of an otherwise upright line.
//
// It is a component rather than inline <em> because the rule is easy to
// overdo. Emphasising two words halves the effect; emphasising a whole
// clause turns it into a pull quote. Passing `emphasis` as a single
// string keeps the discipline visible at every call site.
//
// The site's serif is Playfair Display, which has a genuine italic —
// this is not an oblique. That is why the move works here and would not
// with the body sans.

/**
 * A display heading with optional italic emphasis on one phrase.
 *
 * `emphasis` must appear in `children` verbatim; the first occurrence is
 * italicised and the rest of the line is left upright.
 */
export function Display({
  children,
  emphasis,
  as: Tag = "h2",
  className = "",
}: {
  children: string;
  emphasis?: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  if (!emphasis || !children.includes(emphasis)) {
    return <Tag className={`font-display ${className}`}>{children}</Tag>;
  }

  const at = children.indexOf(emphasis);
  const before = children.slice(0, at);
  const after = children.slice(at + emphasis.length);

  return (
    <Tag className={`font-display ${className}`}>
      {before}
      <em className="italic">{emphasis}</em>
      {after}
    </Tag>
  );
}

/**
 * The small gold flourish that sits between a hero headline and its
 * body copy in the reference — a hairline rule either side of a lozenge.
 *
 * Purely decorative, so aria-hidden. It reads as a breath rather than a
 * divider, which is why it is centred on its own line with generous
 * space rather than run edge to edge.
 */
export function Ornament({
  className = "",
  tone = "light",
  align = "left",
}: {
  className?: string;
  /** "dark" for forest and photographic grounds. */
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const line = tone === "dark" ? "bg-gold/70" : "bg-gold";
  const mark = tone === "dark" ? "text-gold" : "text-goldInk";

  return (
    <div
      aria-hidden
      className={`flex items-center gap-3 ${
        align === "center" ? "justify-center" : ""
      } ${className}`}
    >
      <span className={`h-px w-10 ${line}`} />
      <svg viewBox="0 0 14 14" className={`h-2.5 w-2.5 ${mark}`} fill="currentColor">
        <path d="M7 0l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </svg>
      <span className={`h-px w-10 ${line}`} />
    </div>
  );
}

/**
 * A content band, inset from the page ground.
 *
 * The reference's most distinctive structural move: sections do not run
 * edge to edge, they sit as panels on a cream page with a margin around
 * them and softly rounded corners. It is what gives the page its weight
 * — each band reads as a considered block rather than as a stripe of
 * background colour, which is exactly the difference between editorial
 * composition and a stack of full-width SaaS sections.
 *
 * Full-bleed remains available for the hero, where the photograph should
 * genuinely reach the edges.
 */
export function Band({
  children,
  tone = "cream",
  className = "",
  id,
}: {
  children: ReactNode;
  tone?: "cream" | "parchment" | "sage" | "forest" | "plain";
  className?: string;
  id?: string;
}) {
  const tones = {
    cream: "bg-cream",
    parchment: "bg-parchment",
    sage: "bg-sage/15",
    forest: "bg-forest text-offwhite",
    plain: "bg-offwhite",
  };

  return (
    <div className="bg-offwhite px-3 py-3 sm:px-5 sm:py-4">
      <section
        id={id}
        className={`relative overflow-hidden rounded-[1.25rem] ${tones[tone]} ${className}`}
      >
        {children}
      </section>
    </div>
  );
}
