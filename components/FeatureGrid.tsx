const features = [
  {
    title: "Figure It Out For Me",
    body: "Tell us the basics. We'll help think through the rest.",
  },
  {
    title: "Beforehand Plan",
    body: "A preparation plan built backward from when people arrive.",
  },
  {
    title: "HostReady™",
    body: "Know what matters and whether you're on track.",
  },
  {
    title: "Reminders & Alerts",
    body: "A nudge when it's time to chill the drinks, and a clear alert if something time-sensitive is about to slip.",
  },
  {
    title: "Host Mode™",
    body: "Know what to do right now.",
  },
  {
    title: "My Table",
    body: "Food, quantities, dietary needs, and serving planning.",
  },
  {
    title: "Who's Bringing What",
    body: "Keep potluck and family contributions straight.",
  },
  {
    title: "Co-Host",
    body: "Share the gathering with the person helping make it happen.",
  },
  {
    title: "Shopping",
    body: "Know what you need, what you already have, and what's covered.",
  },
  {
    title: "My Hosting Closet",
    body: "Remember what you already have, gathering after gathering.",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="bg-cream py-20 md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <h2 className="font-display text-4xl text-forest md:text-5xl">
          Everything you need to get ready
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer transition-shadow duration-400 hover:shadow-soft"
            >
              <h3 className="font-display text-lg text-forest">{f.title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
