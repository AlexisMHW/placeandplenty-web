import Image from "next/image";

// Shared furniture for the host workspace surfaces.
//
// The visual language is taken from the approved four-screen app mockup:
// soft panels on parchment, serif headings, a thin gold rule, and —
// importantly — ELEGANT EMPTY STATES rather than blank space. The mockup
// makes a point of this ("Nothing on the table yet. Add a dish to get a
// recommended serving size..."), and it is the difference between a page
// that looks unfinished and one that looks ready for you.
//
// §25: "Do not merely stretch mobile cards across a desktop browser" and
// "do not let the host web experience become an enterprise admin
// dashboard". So there is no data grid, no zebra striping and no dense
// toolbar — panels with air, at desktop widths.

export function WorkspaceHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-sage/25 pb-5">
      <div>
        <h2 className="font-display text-2xl text-forest md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-prose font-body text-base text-forest/70">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * The empty state. Takes the olive mark rather than an icon font,
 * because §4 wants botanical language used "as punctuation" — this is
 * the one place per screen where it earns its keep.
 */
export function EmptyState({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  /** What the host should do about it, usually "in the app". */
  hint?: string;
}) {
  return (
    <div className="mt-8 rounded-card border border-sage/30 bg-parchment px-6 py-12 text-center">
      <Image
        src="/images/olive-mark.png"
        alt=""
        aria-hidden
        width={64}
        height={64}
        className="mx-auto opacity-80"
      />
      <p className="mt-4 font-display text-xl text-forest">{title}</p>
      <p className="mx-auto mt-2 max-w-md font-body text-base leading-relaxed text-forest/70">
        {body}
      </p>
      {hint && (
        <p className="mx-auto mt-3 max-w-md font-body text-sm text-forest/55">
          {hint}
        </p>
      )}
    </div>
  );
}

/** A soft panel. The workspace's only container. */
export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-sage/30 bg-parchment p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A read-only notice.
 *
 * THE WEB APP READS CANONICAL DATA BUT DOES NOT YET WRITE IT. Saying so
 * once, plainly, on each surface is far better than shipping controls
 * that look editable and silently do nothing — and it is the honest
 * version of §30's warning against calling a placeholder complete.
 */
export function ReadOnlyNote({ what }: { what: string }) {
  return (
    <p className="mt-6 rounded-card border border-sage/30 bg-cream px-4 py-3 font-body text-sm leading-relaxed text-forest/75">
      This is your live {what} — the same record the app is reading right
      now. Editing on web is coming; for now, changes are made in the
      Place &amp; Plenty app and appear here immediately.
    </p>
  );
}
