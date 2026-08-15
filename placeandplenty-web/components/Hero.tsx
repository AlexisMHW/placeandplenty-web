import CtaButton from "@/components/CtaButton";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-offwhite">
      <div className="mx-auto grid max-w-editorial gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-4 font-body text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Home hospitality, made simple
          </p>
          <h1 className="font-display text-5xl leading-[1.05] text-forest md:text-6xl">
            People are coming.
          </h1>
          <h2 className="mt-2 font-display text-3xl leading-tight text-olive md:text-4xl">
            We&rsquo;ll help you get ready.
          </h2>
          <p className="mt-6 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Place &amp; Plenty helps you figure out what needs to happen,
            when it needs to happen, who&rsquo;s handling it, and whether
            you&rsquo;re actually ready before people arrive.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton />
          </div>
        </div>

        <div className="relative">
          {/* App screenshot placeholder — clearly isolated for easy swap */}
          <div className="mx-auto flex aspect-[9/16] max-w-xs items-center justify-center rounded-[2rem] border border-sage/40 bg-cream shadow-soft">
            <p className="px-8 text-center font-body text-sm text-forest/50">
              [ Placeholder: app screenshot — Beforehand Plan or HostReady
              view ]
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
