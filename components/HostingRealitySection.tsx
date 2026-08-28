import Eyebrow from "@/components/Eyebrow";

// §5, beat 5: "Hosting reality / 'Okay, people are coming. Now what?'"
//
// This is the turn in the homepage's argument. Everything above it is
// warm and seasonal — reasons to gather, ideas for gathering. This is
// where the page admits what actually happens after you send the text,
// and it has to land before the product is introduced, or the product
// arrives as a solution to a problem nobody has agreed exists yet.
//
// It replaces the old ProblemSection on the homepage. That component was
// a nine-item grid under "Planning the gathering isn't always the hard
// part" — true, but it read as a feature list of anxieties. This is
// shorter, in the second person, and structured as the actual sequence
// of thoughts rather than a grid: §5 warns specifically against
// defaulting to hero -> feature grid -> another feature grid.
//
// Voice per §1: warm, practical, lightly witty. The joke is recognition,
// not cynicism — the tone is "yes, that is exactly what happens", never
// "hosting is a nightmare". §1 also rules out "cold productivity
// software language", so nothing here is framed as tasks or efficiency.

const thoughts = [
  {
    line: "How many people is that, actually?",
    body: "Six said yes. Two said maybe. One is bringing someone you have not met.",
  },
  {
    line: "What am I feeding them?",
    body: "And how much of it, and does anyone not eat something, and is one of them the friend who eats like three people.",
  },
  {
    line: "Do I own enough chairs?",
    body: "You own enough chairs. They are in four different rooms and one is in the garage.",
  },
  {
    line: "What do I still need to buy?",
    body: "Not the things you already own and cannot find. The other things.",
  },
  {
    line: "Who said they’d bring something?",
    body: "It was in a text. Or a group chat. Or possibly a different group chat.",
  },
  {
    line: "When do I actually have to start?",
    body: "This is the one nobody works out until it is too late to change the answer.",
  },
];

export default function HostingRealitySection() {
  return (
    <section className="bg-parchment py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <Eyebrow>The bit after you send the text</Eyebrow>

        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
          Okay. People are coming. Now what?
        </h2>

        <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
          Deciding to have people over takes about four seconds. Everything
          after that is the part nobody sees.
        </p>

        <ul className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {thoughts.map((t) => (
            <li key={t.line} className="border-l-2 border-gold/70 pl-5">
              <p className="font-display text-xl leading-snug text-forest">
                {t.line}
              </p>
              <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                {t.body}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-12 max-w-prose font-display text-2xl italic leading-snug text-forest">
          None of that is the fun part. All of it is the difference between
          a good evening and a long one.
        </p>
      </div>
    </section>
  );
}
