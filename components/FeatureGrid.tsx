import Link from "next/link";
import Eyebrow from "@/components/Eyebrow";
import { HEADLINE_FEATURES } from "@/lib/features";

// The homepage feature row — the board's six, in the board's order.
//
// Names come from lib/features.ts rather than being typed here, because
// this is exactly the surface §30 flags for stale terminology (My Address
// Book, My Shopping List, standalone My Budget). One source, one rename.

export default function FeatureGrid() {
  return (
    <section id="features" className="bg-offwhite py-20 md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <Eyebrow>What it does</Eyebrow>

        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight text-forest md:text-4xl">
          The part nobody sees, handled.
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {HEADLINE_FEATURES.map((f) => (
            <li key={f.name}>
              <span aria-hidden className="mb-3 block h-px w-8 bg-gold" />
              <h3 className="font-display text-xl text-forest">{f.name}</h3>
              <p className="mt-2 font-body text-base leading-relaxed text-forest/75">
                {f.body}
              </p>
            </li>
          ))}
        </ul>

        <Link
          href="/what-it-does"
          className="mt-12 inline-flex items-center gap-1.5 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-forest transition-colors duration-400 hover:text-sage"
        >
          Everything it does
          <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
