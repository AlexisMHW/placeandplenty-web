import Eyebrow from "@/components/Eyebrow";

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
    <section id="how-it-works" className="bg-parchment py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <Eyebrow>How it works</Eyebrow>

        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
          Four steps, and most of them think for you.
        </h2>

        <ol className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {steps.map((s) => (
            <li key={s.step} className="flex flex-col">
              {/* goldInk, not gold: at 30px this still needs 3:1 and gold
                  is 2.25:1 on a light ground. See tailwind.config.ts. */}
              <span aria-hidden className="font-display text-3xl text-goldInk">
                {s.step}
              </span>
              <h3 className="mt-3 font-display text-xl text-forest">
                {s.title}
              </h3>
              <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
