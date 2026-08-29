import Link from "next/link";
import { Display, Band } from "@/components/Display";
import { BotanicalSprig } from "@/components/Botanical";
import Icon, { type IconName } from "@/components/Icon";

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
    icon: "envelope" as IconName,
  },
  {
    name: "RSVPs",
    body: "Track responses, plus ones, and dietary needs.",
    icon: "rsvp" as IconName,
  },
  {
    name: "Who’s Bringing What",
    body: "Contributions that keep the table balanced.",
    icon: "dish" as IconName,
  },
  {
    name: "My Guest Book",
    body: "The people you host most, kept for next time.",
    icon: "book" as IconName,
  },
  {
    name: "HostReady™",
    body: "A readiness score for every gathering.",
    icon: "gauge" as IconName,
  },
  {
    name: "My Shopping",
    body: "Lists and budget together, so you buy less.",
    icon: "cart" as IconName,
  },
  {
    name: "My Hosting Closet",
    body: "What you already own, and where it lives.",
    icon: "closet" as IconName,
  },
  {
    name: "My People",
    body: "Guests, contacts and notes in one place.",
    icon: "people" as IconName,
  },
] as const;

// ICONS COME FROM THE SHARED SET (components/Icon.tsx). This band used
// to carry its own eight hand-drawn glyphs, which was right when it was
// the only iconographic surface on the site and wrong the moment What It
// Does, How It Works and About grew their own. One icon language, drawn
// once, at one stroke weight — two sets at slightly different weights is
// exactly the kind of drift a visitor notices without being able to name.

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
                <Icon name={item.icon} size={28} className="text-goldInk" />
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
