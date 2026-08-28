// The small uppercase label that sits above a heading.
//
// It used to be `text-gold`, which is 2.25:1 on offwhite — a WCAG AA
// failure repeated on nearly every section of the site. Gold stays, but
// as the rule beside the words rather than the words themselves, which
// is also what the approved visual board actually shows. See the note in
// tailwind.config.ts.

export default function Eyebrow({
  children,
  tone = "light",
  className = "",
}: {
  children: React.ReactNode;
  /** "light" for cream/offwhite grounds, "dark" for forest ones. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const text = tone === "dark" ? "text-offwhite/80" : "text-forest/75";
  const rule = tone === "dark" ? "bg-gold" : "bg-gold";

  return (
    <p
      className={`flex items-center gap-3 font-body text-xs font-bold uppercase tracking-[0.2em] ${text} ${className}`}
    >
      <span aria-hidden className={`h-px w-6 flex-shrink-0 ${rule}`} />
      {children}
    </p>
  );
}
