const occasions = [
  "Thanksgiving",
  "Birthdays",
  "Brunch",
  "Cookouts",
  "Baby showers",
  "Sunday dinner",
  "Friendsgiving",
  "Family gatherings",
  "Holiday parties",
  "Game nights",
];

export default function UseCaseSection() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <h2 className="font-display text-4xl text-forest md:text-5xl">
          Place &amp; Plenty is for having people over.
        </h2>
        <p className="mt-3 max-w-prose font-body text-lg text-forest/70">
          Not just the big ones.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {occasions.map((o) => (
            <span
              key={o}
              className="rounded-full border border-olive/40 bg-cream px-5 py-2 font-body text-sm text-forest"
            >
              {o}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
