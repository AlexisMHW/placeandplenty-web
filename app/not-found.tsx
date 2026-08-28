import Link from "next/link";
import { PRIMARY_NAV } from "@/lib/nav";
import { TAGLINE } from "@/lib/brand";

// The 404. §7 lists it as a required V1 experience, and "none of these
// should be called complete if they are only placeholders" applies to
// this page too.
//
// IT LIVES AT THE APP ROOT, NOT INSIDE (marketing), and that placement
// is deliberate. Next only uses a route group's not-found for unmatched
// paths BELOW that group's segments; a URL like /nonsense matches no
// group at all, so it falls through to the root. Putting this file in
// (marketing) would leave the most common 404 — a mistyped or dead
// external link — rendering Next's default black-on-white error page.
//
// The cost of living at the root is that it renders outside both
// layouts, so it has no header and no footer. That is why it carries its
// own mark and its own way back: a 404 with no navigation is a dead end.
//
// Voice per §1: warm and lightly witty, never cute about the failure.
// The joke is a hosting joke, not an apology.

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <header className="border-b border-sage/25">
        <div className="mx-auto max-w-editorial px-6 py-5">
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-tight text-forest"
          >
            Place &amp; Plenty
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-prose flex-1 flex-col justify-center px-6 py-20">
        <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
          404
        </p>

        <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">
          This one isn&rsquo;t on the list.
        </h1>

        <p className="mt-5 font-body text-lg leading-relaxed text-forest/80">
          The page you were after has moved, or never existed. Either way,
          it isn&rsquo;t here — so let&rsquo;s get you somewhere useful.
        </p>

        <nav aria-label="Popular pages" className="mt-10">
          <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
            Try one of these
          </h2>
          <ul className="mt-4 space-y-3">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="font-display text-xl text-forest underline decoration-gold underline-offset-4 transition-colors duration-400 hover:text-sage"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="mt-10 font-body text-base text-forest/70">
          If you were sent an invitation link and it brought you here, the
          link is probably incomplete — ask your host to send it again, or{" "}
          <Link
            href="/support"
            className="underline decoration-gold underline-offset-4 hover:text-forest"
          >
            get in touch
          </Link>
          .
        </p>
      </main>

      <footer className="border-t border-sage/25 py-6">
        <p className="mx-auto max-w-editorial px-6 font-body text-xs text-forest/50">
          {TAGLINE}
        </p>
      </footer>
    </div>
  );
}
