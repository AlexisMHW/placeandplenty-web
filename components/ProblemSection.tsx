const problems = [
  "Remembering what needs to happen",
  "Knowing when to do it",
  "Keeping track of the food",
  "Shopping — without buying what you already have",
  "Seating and guest count",
  "Who's bringing what",
  "Co-host responsibilities",
  "Getting yourself ready, too",
  "Knowing what can safely wait",
];

export default function ProblemSection() {
  return (
    <section className="bg-forest py-20 text-offwhite md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <div className="max-w-prose">
          <h2 className="font-display text-4xl leading-tight md:text-5xl">
            Planning the gathering isn&rsquo;t always the hard part.
          </h2>
          <p className="mt-4 font-body text-lg text-offwhite/80">
            The hard part is everything underneath it — the dozens of small
            things that have to line up before the doorbell rings.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
          {problems.map((item) => (
            <li
              key={item}
              className="border-l-2 border-gold/60 py-1 pl-4 font-body text-offwhite/90"
            >
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-14 font-display text-2xl italic text-gold">
          Less scrambling. More gathering.
        </p>
      </div>
    </section>
  );
}
