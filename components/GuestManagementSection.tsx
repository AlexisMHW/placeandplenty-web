import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import { Display } from "@/components/Display";

// THE COMPETITIVE POSITIONING SECTION. §3 is unusually direct about this
// one: "This is not a minor feature section. It is a core positioning
// advantage" — and §28 lists its absence as a known gap, with the
// invitation line specifically called out as needing to become "visible
// positioning, not hidden FAQ copy".
//
// So it is a full-width band with its own beat on the homepage, placed
// before the feature grid rather than inside it. §32: do not bury
// Invitations / RSVPs / Who's Bringing What / My Guest Book.
//
// THE ARGUMENT, in the order §3 makes it:
//
//   1. Place & Plenty does not begin with the invitation. It begins with
//      "people are coming". The invitation is one part of a larger
//      workflow, which is why the loop below starts at "invite them" and
//      keeps going long after an invitation app would have stopped.
//
//   2. Bring your own invitations. This is the differentiator against
//      invitation-first competitors: we are not asking anyone to abandon
//      Etsy, Canva, Paperless Post, a PDF or something already printed
//      and posted. §3 is explicit that the point is NOT to force hosts
//      off artwork they already have.
//
//   3. The loop is the retention argument — invite them, know who's
//      coming, know what they're bringing, keep your people for next
//      time. My Guest Book is what makes the fourth step true, and it is
//      why the second gathering is easier than the first.
//
// My People vs My Guest Book is drawn explicitly, because §10 says the
// distinction must be obvious:
//   My People     = people for THIS gathering
//   My Guest Book = reusable people, account-level

const loop = [
  {
    step: "Invite them",
    body: "Use a Place & Plenty invitation, or bring your own artwork. Either way the guest list is real from the moment you send it.",
    where: "My People",
  },
  {
    step: "Know who’s coming",
    body: "RSVPs land against the actual guest — not in a form you then have to copy somewhere. Households answer once, the way they actually decide.",
    where: "My People",
  },
  {
    step: "Know what they’re bringing",
    body: "Contributions sit on the same guest and gathering records. No parallel spreadsheet, no four texts about the same casserole.",
    where: "Who’s Bringing What",
  },
  {
    step: "Keep your people for next time",
    body: "The people you host most often stay in one place, so the next gathering doesn’t start from an empty list.",
    where: "My Guest Book",
  },
];

export default function GuestManagementSection({
  compact = false,
}: {
  /**
   * On the homepage the loop and the invitation line carry the
   * positioning; the My People / My Guest Book breakdown below them is
   * the same content /what-it-does already gives in full, so the
   * homepage links instead of repeating it.
   */
  compact?: boolean;
} = {}) {
  return (
    <section className="bg-forest py-20 text-offwhite md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <Eyebrow tone="dark">Invitations, RSVPs &amp; your people</Eyebrow>

        <Display
          emphasis="starts"
          className="mt-4 max-w-3xl text-3xl leading-tight md:text-4xl"
        >
          Most apps stop at the invitation. That’s about where the work starts.
        </Display>

        <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
          Place &amp; Plenty doesn’t begin with the invitation. It begins with
          &ldquo;people are coming&rdquo; — and it keeps going all the way to
          the doorbell.
        </p>

        {/* The invitation-flexibility line. §10: prominent enough to
            function as competitive positioning. */}
        <div className="mt-10 rounded-card border border-gold/60 bg-offwhite/5 p-6 md:p-8">
          <p className="font-display text-2xl leading-snug text-offwhite md:text-3xl">
            Got your own invitations? Bring them over.
            <br className="hidden sm:block" />{" "}
            <span className="text-gold">Yeah, we handle that too.</span>
          </p>
          <p className="mt-4 max-w-prose font-body text-base leading-relaxed text-offwhite/80">
            Made something on Canva. Bought it on Etsy. Sent it on Paperless
            Post. Printed and posted it three weeks ago. None of that is a
            problem — bring the artwork, or bring nothing at all, and use
            Place &amp; Plenty for everything that comes after.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {loop.map((item, i) => (
            <li key={item.step} className="relative">
              <span
                aria-hidden
                className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {item.step}
              </h3>
              <p className="mt-2 font-body text-base leading-relaxed text-offwhite/80">
                {item.body}
              </p>
              <p className="mt-3 font-body text-xs uppercase tracking-[0.15em] text-offwhite/55">
                {item.where}
              </p>
            </li>
          ))}
        </ol>

        {!compact && (
        <div className="mt-12 grid gap-6 border-t border-offwhite/15 pt-10 sm:grid-cols-2">
          <div>
            <h3 className="font-display text-xl">My People</h3>
            <p className="mt-2 font-body text-base leading-relaxed text-offwhite/80">
              The people for <em className="not-italic font-semibold">this</em>{" "}
              gathering. Invitations, RSVPs, households, contributions,
              dietary notes and messages — one guest, one record.
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl">My Guest Book</h3>
            <p className="mt-2 font-body text-base leading-relaxed text-offwhite/80">
              Keep the people you host most often in one place. Reusable
              across every gathering, so you never rebuild the same list
              twice.
            </p>
          </div>
        </div>
        )}

        <Link
          href="/what-it-does"
          className="mt-10 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-offwhite transition-colors duration-400 hover:text-gold"
        >
          See how the whole thing fits together
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
