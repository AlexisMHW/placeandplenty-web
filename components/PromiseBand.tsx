import Eyebrow from "@/components/Eyebrow";
import { PROMISE, RALLY } from "@/lib/brand";

// The brand promise, stated once, in the words the board and §1 fix:
// "Everything between 'people are coming' and the doorbell ringing", and
// "Less scrambling. More gathering."
//
// Deliberately typographic rather than another photograph — the page has
// a photographic hero above and photographic cards below, and a third
// image here would flatten all three. This is the beat where the page
// stops and says what the product is for.

export default function PromiseBand() {
  return (
    <section className="bg-forest py-20 text-offwhite md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <Eyebrow tone="dark">Our promise</Eyebrow>

        <p className="mt-6 max-w-3xl font-display text-3xl leading-snug md:text-4xl">
          {PROMISE}
        </p>

        <p className="mt-6 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
          Not another place to make a pretty invitation. A place to work out
          the menu, the shopping, the timing, who&rsquo;s bringing what, what
          you already own, and whether you&rsquo;re actually ready — before
          anyone knocks.
        </p>

        <p className="mt-10 font-display text-2xl italic text-gold">
          {RALLY}
        </p>
      </div>
    </section>
  );
}
