import type { ReactNode } from "react";

// Shared shell for the long-form legal pages (/privacy, /terms).
// Keeps them in the Place & Plenty visual language — cream/forest/gold,
// Playfair display headings, Lato body — rather than looking like a
// dumped text file, while staying readable at prose width.

export default function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-offwhite py-16 md:py-24">
      <div className="mx-auto max-w-prose px-6">
        <h1 className="font-display text-4xl leading-tight text-forest md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 font-body text-xs uppercase tracking-[0.15em] text-forest/50">
          Last updated {lastUpdated}
        </p>

        {intro && (
          <div className="mt-8 font-body text-lg leading-relaxed text-forest/80">
            {intro}
          </div>
        )}

        <div
          className="
            mt-12 font-body text-forest/80
            [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-forest
            [&_h3]:mt-8 [&_h3]:font-body [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-forest
            [&_p]:mt-4 [&_p]:leading-relaxed
            [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5
            [&_li]:list-disc [&_li]:leading-relaxed [&_li]:marker:text-gold
            [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-4 [&_a:hover]:text-forest
            [&_strong]:font-semibold [&_strong]:text-forest
          "
        >
          {children}
        </div>
      </div>
    </section>
  );
}

// A pulled-out box for the things a reader most needs to actually see.
export function LegalCallout({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-8 rounded-card border border-gold bg-cream p-6">
      <p className="font-body text-xs font-bold uppercase tracking-wide text-forest/60">
        {heading}
      </p>
      <div className="mt-2 font-body text-sm leading-relaxed text-forest/80 [&_p]:mt-2 [&_p:first-child]:mt-0 [&_li]:list-disc [&_li]:leading-relaxed [&_li]:marker:text-gold [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
