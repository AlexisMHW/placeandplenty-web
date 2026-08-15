const steps = [
  {
    step: "1",
    title: "Tell us what's happening.",
    body: "Create your gathering — who's coming, when, and where.",
  },
  {
    step: "2",
    title: "Figure It Out For Me.",
    body: "Place & Plenty builds your personalized preparation plan.",
  },
  {
    step: "3",
    title: "Get HostReady™.",
    body: "See what matters, what's next, and whether you're actually ready.",
  },
  {
    step: "4",
    title: "Enjoy your people.",
    body: "When the important things are handled, stop working and start gathering.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-editorial px-6">
        <h2 className="font-display text-4xl text-forest md:text-5xl">
          How it works
        </h2>

        <ol className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
          {steps.map((s) => (
            <li key={s.step} className="flex flex-col">
              <span className="font-display text-3xl text-gold">
                {s.step}
              </span>
              <h3 className="mt-3 font-display text-xl text-forest">
                {s.title}
              </h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
