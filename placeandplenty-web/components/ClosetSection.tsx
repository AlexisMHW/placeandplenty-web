const closetItems = [
  { label: "Dinner Plates", value: "18" },
  { label: "Wine Glasses", value: "12" },
  { label: "Folding Chairs", value: "8" },
  { label: "White Tablecloths", value: "3" },
  { label: "Large Platters", value: "4" },
  { label: "Beverage Dispensers", value: "2" },
];

const readiness = [
  { label: "Platters", status: "Covered", ok: true },
  { label: "Beverage dispensers", status: "Covered", ok: true },
  { label: "Dinner plates", status: "Need 6 more", ok: false },
  { label: "Seating", status: "Need 4 more", ok: false },
];

export default function ClosetSection() {
  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
              Hosting Closet&trade;
            </p>
            <h2 className="font-display text-4xl leading-tight text-forest md:text-5xl">
              You probably already have more than you think.
            </h2>
            <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
              My Hosting Closet&trade; keeps track of the serving pieces,
              linens, chairs, glassware, and gathering essentials you already
              own — so Place &amp; Plenty can help you use what you have
              before adding something else to the shopping list.
            </p>
            <p className="mt-4 font-display text-xl italic text-olive">
              Know what you have. Know what you need.
            </p>
          </div>

          <div className="rounded-card border border-sage/30 bg-cream p-6 shadow-soft">
            <p className="font-body text-xs font-bold uppercase tracking-wide text-forest/60">
              My Hosting Closet
            </p>
            <ul className="mt-4 divide-y divide-sage/20">
              {closetItems.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between py-2 font-body text-sm text-forest/80"
                >
                  <span>{item.label}</span>
                  <span className="font-semibold text-forest">
                    {item.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-card border border-sage/30 bg-forest p-6 text-offwhite shadow-soft md:p-8">
          <p className="font-body text-xs font-bold uppercase tracking-wide text-offwhite/60">
            For Thanksgiving
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {readiness.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 font-body text-sm"
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                    item.ok
                      ? "bg-olive text-offwhite"
                      : "bg-gold text-forest"
                  }`}
                >
                  {item.ok ? "✓" : "!"}
                </span>
                <span>
                  {item.label} — {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
