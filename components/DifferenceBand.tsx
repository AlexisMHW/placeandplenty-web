import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";

// THE PLACE & PLENTY DIFFERENCE — the reference's two-column band, and
// the site's competitive positioning in one place.
//
// §3 calls guest management "a core positioning advantage, not a minor
// feature section", and §28 lists the invitation line as needing to be
// visible positioning rather than FAQ copy. The reference agrees: it
// gives this the widest, most detailed treatment on the page, with the
// invitation line set in italic serif as a statement.
//
// THREE NAMES IN THE REFERENCE ARE STALE AND ARE NOT COPIED.
//
//   "My Shopping List"  -> My Shopping. §9/§32 forbid the old name; the
//                          list and the budget are one card now.
//   Two sign-in buttons -> one. There is one Supabase identity; a
//                          separate "Host Login" would imply two.
//   Space Mode as "your guests stay in the app" -> that describes the
//                          guest experience, not Space Mode, which is
//                          about how a ROOM works. Not repeated.
//
// The reference's own instruction is that it governs look, weight,
// composition, photography, botanicals and pacing — product truth comes
// from the reconciliation document. This band follows its composition
// exactly and its labels only where they are still correct.
//
// GROUPING: the eight are shown as one grid because this is a
// DIFFERENTIATOR list, not a Hosting Hub diagram. §9's rule against
// mixing Hub cards with system-level capabilities governs /what-it-does,
// where the page claims to describe the product's architecture. Here the
// claim is "this is what sets us apart", and HostReady belongs in that
// sentence next to My People.

const DIFFERENCE = [
  {
    name: "Invitations",
    body: "Use ours, or bring artwork you already made.",
    icon: "envelope",
  },
  {
    name: "RSVPs",
    body: "Track responses, plus ones, and dietary needs.",
    icon: "people",
  },
  {
    name: "Who’s Bringing What",
    body: "Contributions that keep the table balanced.",
    icon: "dish",
  },
  {
    name: "My Guest Book",
    body: "The people you host most, kept for next time.",
    icon: "book",
  },
  {
    name: "HostReady™",
    body: "A readiness score for every gathering.",
    icon: "shield",
  },
  {
    name: "My Shopping",
    body: "Lists and budget together, so you buy less.",
    icon: "bag",
  },
  {
    name: "My Hosting Closet",
    body: "What you already own, and where it lives.",
    icon: "door",
  },
  {
    name: "My People",
    body: "Guests, contacts and notes in one place.",
    icon: "group",
  },
] as const;

// Line-art icons, drawn to one weight so the grid reads as a set. Gold
// stroke on cream, as the reference has them.
function Icon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<string, JSX.Element> = {
    envelope: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="1.5" {...common} />
        <path d="M3.5 7l8.5 6 8.5-6" {...common} />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3" {...common} />
        <circle cx="16" cy="10.5" r="2.2" {...common} />
        <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" {...common} />
        <path d="M15 19c0-2 1-3.6 2.5-4.3" {...common} />
      </>
    ),
    dish: (
      <>
        <path d="M4 15h16" {...common} />
        <path d="M5.5 15a6.5 6.5 0 0113 0" {...common} />
        <path d="M12 6.5V5" {...common} />
        <path d="M3 18h18" {...common} />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5h6a2 2 0 012 2V19a2 2 0 00-2-2H4z" {...common} />
        <path d="M20 5.5h-6a2 2 0 00-2 2V19a2 2 0 012-2h6z" {...common} />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5l7 2.5v5.5c0 4-3 7.4-7 9-4-1.6-7-5-7-9V6z" {...common} />
        <path d="M9 12l2.2 2.2L15.5 10" {...common} />
      </>
    ),
    bag: (
      <>
        <path d="M5.5 8h13l-1 11.5h-11z" {...common} />
        <path d="M9 8V6.5a3 3 0 016 0V8" {...common} />
      </>
    ),
    door: (
      <>
        <rect x="6" y="3.5" width="12" height="17" rx="1.2" {...common} />
        <circle cx="14.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
    group: (
      <>
        <circle cx="12" cy="8" r="3" {...common} />
        <circle cx="5.5" cy="10.5" r="2.2" {...common} />
        <circle cx="18.5" cy="10.5" r="2.2" {...common} />
        <path d="M6.5 19c0-3 2.5-5.2 5.5-5.2S17.5 16 17.5 19" {...common} />
      </>
    ),
  };

  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 text-goldInk">
      {paths[name]}
    </svg>
  );
}

export default function DifferenceBand() {
  return (
    <Band tone="sage">
      <BotanicalSprig
        className="pointer-events-none absolute -right-8 bottom-0 hidden text-olive/30 lg:block"
        size={220}
      />

      <div className="relative mx-auto grid max-w-editorial gap-12 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-16">
        <div>
          <Display className="text-3xl leading-tight text-forest md:text-4xl">
            The hosting platform built for real life.
          </Display>

          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Place &amp; Plenty brings everything together so you can focus on
            what matters — your people.
          </p>

          {/* The invitation line. §10: prominent enough to function as
              competitive positioning, not hidden FAQ copy. Italic serif,
              as the reference sets it. */}
          <div className="mt-10 border-l-2 border-gold pl-6">
            <p className="font-display text-2xl italic leading-snug text-forest">
              Got your own invitations? Bring them over. Yeah, we handle that
              too.
            </p>
            <p className="mt-4 max-w-prose font-body text-base leading-relaxed text-forest/75">
              Made it on Canva. Bought it on Etsy. Sent it on Paperless Post.
              Printed and posted it three weeks ago. Bring the artwork, or
              bring nothing at all — Place &amp; Plenty handles everything
              after it.
            </p>
          </div>

          <Link
            href="/what-it-does"
            className="mt-8 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
          >
            See everything it does
            <span aria-hidden>&rarr;</span>
          </Link>
        </div>

        <div>
          <p className="flex items-center gap-4 font-body text-xs font-bold uppercase tracking-[0.22em] text-forest/70">
            <span aria-hidden className="h-px flex-1 bg-gold/60" />
            The Place &amp; Plenty difference
            <span aria-hidden className="h-px flex-1 bg-gold/60" />
          </p>

          <ul className="mt-9 grid grid-cols-2 gap-x-8 gap-y-9 lg:grid-cols-4">
            {DIFFERENCE.map((item) => (
              <li key={item.name}>
                <Icon name={item.icon} />
                <h3 className="mt-3 font-display text-base leading-snug text-forest">
                  {item.name}
                </h3>
                <p className="mt-1.5 font-body text-sm leading-relaxed text-forest/70">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Band>
  );
}
