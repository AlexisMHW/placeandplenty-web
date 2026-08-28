import Image from "next/image";

export default function PhilosophySection() {
  return (
    <section className="bg-parchment py-20 md:py-24">
      <div className="mx-auto grid max-w-editorial items-center gap-12 px-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-card shadow-soft">
          <Image
            src="/images/hero-tabletop.jpg"
            alt="A warmly set gathering table, ready for guests"
            width={1400}
            height={1111}
            className="h-full w-full object-cover"
          />
        </div>

        <div>
          <p className="font-display text-3xl italic leading-relaxed text-forest md:text-4xl">
            The preparation serves the people.
            <br />
            The people are the point.
          </p>
          <p className="mt-8 font-body text-base leading-relaxed text-forest/70">
            Place &amp; Plenty exists so the host can be present for the
            gathering — not spend the whole thing working.
          </p>
        </div>
      </div>
    </section>
  );
}

