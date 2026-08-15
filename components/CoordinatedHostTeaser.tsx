import Link from "next/link";

export default function CoordinatedHostTeaser() {
  return (
    <section className="bg-forest py-20 text-offwhite md:py-28">
      <div className="mx-auto max-w-editorial px-6 text-center">
        <h2 className="font-display text-4xl md:text-5xl">
          The Coordinated Host
        </h2>
        <p className="mx-auto mt-4 max-w-prose font-body text-lg text-offwhite/80">
          Practical ideas for getting ready for people without doing more
          than you need to.
        </p>
        <Link
          href="/coordinated-host"
          className="mt-8 inline-block border-b border-gold font-body text-sm font-semibold uppercase tracking-wide text-gold transition-colors duration-400 hover:text-offwhite"
        >
          Read the latest
        </Link>
      </div>
    </section>
  );
}
