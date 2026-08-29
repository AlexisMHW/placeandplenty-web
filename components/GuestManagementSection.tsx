import Link from "next/link";
import { Band, Display } from "@/components/Display";
import { BotanicalBough } from "@/components/Botanical";
import Icon, { type IconName } from "@/components/Icon";

// THE COMPETITIVE POSITIONING BAND, composed to the "YOUR GUEST
// MANAGEMENT ADVANTAGE" section of `What_it_does.png`.
//
// §3 is unusually direct about this one: "This is not a minor feature
// section. It is a core positioning advantage" — and §28 lists its
// weakness as a known gap, with the invitation line specifically called
// out as needing to become "visible positioning, not hidden FAQ copy".
//
// THE REFERENCE'S COMPOSITION, followed closely because it is what makes
// the argument land as positioning rather than as another feature list:
//
//   left    the claim, stacked in the display serif — four product names
//           as four sentences — then the italic "Yep, we do that.",
//           then the bring-your-own lines, then a link
//   right   four columns behind vertical hairlines, each an icon over a
//           name over three lines of what it does
//   below   the loop, which is the retention argument and the thing an
//           invitation-first product cannot draw at all
//
// THE ARGUMENT, in the order §3 makes it:
//
//   1. Place & Plenty does not begin with the invitation. It begins with
//      "people are coming". The invitation is one part of a larger
//      workflow, which is why the loop starts at "invite them" and keeps
//      going long after an invitation app would have stopped.
//
//   2. Bring your own invitations. The differentiator against
//      invitation-first competitors: nobody is asked to abandon Etsy,
//      Canva, Paperless Post, a PDF, or something already printed and
//      posted. §3 is explicit that the point is NOT to force hosts off
//      artwork they already have.
//
//   3. The loop is the retention argument — invite them, know who's
//      coming, know what they're bringing, keep your people for next
//      time. My Guest Book makes the fourth step true, and it is why the
//      second gathering is easier than the first.
//
// My People vs My Guest Book is drawn explicitly, because §10 says the
// distinction must be obvious:
//   My People     = people for THIS gathering
//   My Guest Book = reusable people, account-level

const PILLARS: { icon: IconName; name: string; body: string }[] = [
  {
    icon: "envelope",
    name: "Invitations",
    body: "Send ours, or upload the artwork you already made. Either way the guest list is real from the moment it goes out.",
  },
  {
    icon: "rsvp",
    name: "RSVPs",
    body: "Replies land against the actual guest, not in a form you then copy somewhere. Households answer once, the way they decide.",
  },
  {
    icon: "gift",
    name: "Who’s Bringing What",
    body: "Contributions sit on the same guest and gathering records — no parallel spreadsheet, no four texts about one casserole.",
  },
  {
    icon: "book",
    name: "My Guest Book",
    body: "The people you host most often, kept long after the last guest leaves, so the next list isn’t built from nothing.",
  },
];

const LOOP = [
  { step: "Invite them", where: "My People" },
  { step: "Know who’s coming", where: "RSVPs" },
  { step: "Know what they’re bringing", where: "Who’s Bringing What" },
  { step: "Keep your people for next time", where: "My Guest Book" },
];

export default function GuestManagementSection({
  compact = false,
}: {
  /**
   * On the homepage the claim and the invitation line carry the
   * positioning; the My People / My Guest Book breakdown is the same
   * content /what-it-does gives in full, so the homepage links instead
   * of repeating it.
   */
  compact?: boolean;
} = {}) {
  return (
    <Band tone="parchment">
      <div className="relative">
        <BotanicalBough
          className="pointer-events-none absolute -right-12 top-8 hidden text-olive/35 lg:block"
          width={230}
          flip
        />

        <div className="relative mx-auto max-w-editorial px-6 py-16 md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/65">
            Your guest management advantage
          </p>

          <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-14">
            {/* ---- the claim -------------------------------------- */}
            <div>
              <h2 className="font-display text-[1.9rem] leading-[1.2] text-forest md:text-[2.15rem]">
                Invitations. RSVPs.
                <br />
                Who’s Bringing What.
                <br />
                My Guest Book.
              </h2>

              <p className="mt-4 font-display text-3xl italic leading-tight text-sage md:text-[2.1rem]">
                Yep, we do that.
              </p>

              <div className="mt-7 border-l-2 border-gold pl-5">
                <p className="font-body text-base leading-relaxed text-forest/85">
                  Got your own invitations?
                  <br />
                  Bring them over.
                  <br />
                  <strong className="font-semibold text-forest">
                    Yeah, we handle that too.
                  </strong>
                </p>
                <p className="mt-4 max-w-prose font-body text-sm leading-relaxed text-forest/70">
                  Made on Canva. Bought on Etsy. Sent on Paperless Post. Printed
                  and posted three weeks ago. None of that is a problem — bring
                  the artwork, or bring nothing at all, and use Place &amp;
                  Plenty for everything that comes after.
                </p>
              </div>

              <Link
                href="/how-it-works"
                className="mt-7 inline-block font-body text-sm font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-sage"
              >
                See how guest management works <span aria-hidden>&rarr;</span>
              </Link>
            </div>

            {/* ---- the four pillars -------------------------------- */}
            <ul className="grid grid-cols-2 gap-y-10 lg:grid-cols-4 lg:gap-y-0">
              {PILLARS.map((p, i) => (
                <li
                  key={p.name}
                  className={`px-4 text-center lg:px-5 ${
                    i > 0 ? "lg:border-l lg:border-sage/30" : ""
                  }`}
                >
                  <Icon
                    name={p.icon}
                    size={30}
                    className="mx-auto text-forest/70"
                  />
                  <h3 className="mt-4 font-display text-base leading-snug text-forest">
                    {p.name}
                  </h3>
                  <p className="mt-2.5 font-body text-[0.82rem] leading-relaxed text-forest/70">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* ---- the loop ------------------------------------------ */}
          <div className="mt-14 rounded-2xl bg-forest px-6 py-10 text-offwhite md:px-10">
            <Display
              emphasis="loop"
              className="text-center text-xl leading-snug md:text-2xl"
            >
              Most apps stop at the invitation. This is the loop that starts
              there.
            </Display>

            <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {LOOP.map((item, i) => (
                <li key={item.step} className="relative">
                  <span
                    aria-hidden
                    className="font-body text-xs font-bold uppercase tracking-[0.2em] text-gold"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 font-display text-lg leading-snug">
                    {item.step}
                  </p>
                  <p className="mt-1.5 font-body text-[0.72rem] uppercase tracking-[0.15em] text-offwhite/55">
                    {item.where}
                  </p>
                  {i < LOOP.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute -right-3 top-8 hidden text-gold/60 lg:block"
                    >
                      &rarr;
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {!compact && (
            <div className="mt-12 grid gap-8 border-t border-sage/30 pt-10 sm:grid-cols-2">
              <div>
                <h3 className="font-display text-xl text-forest">My People</h3>
                <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                  The people for{" "}
                  <em className="font-semibold not-italic">this</em> gathering.
                  Invitations, RSVPs, households, contributions, dietary notes
                  and messages — one guest, one record.
                </p>
              </div>
              <div>
                <h3 className="font-display text-xl text-forest">
                  My Guest Book
                </h3>
                <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                  Keep the people you host most often in one place. Reusable
                  across every gathering, so you never rebuild the same list
                  twice.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Band>
  );
}
