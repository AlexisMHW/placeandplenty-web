import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import type { Post } from "@/lib/tina-content";

// The Coordinated Host on the homepage. Directive §15: the editorial
// layer answers "how do I host this better?" — as against Gathering
// Ideas, which answers "what should we gather for?". The two cross-link
// but are not interchangeable, which is why they get separate sections
// with separate voices rather than one mixed content rail.
//
// Falls back to a plain invitation to the section when nothing is
// featured, because The Coordinated Host is a standing destination in the
// nav — a visitor who has seen the name should be able to reach it from
// here whether or not the founder has picked features this week.

export default function FeaturedArticles({ posts }: { posts: Post[] }) {
  return (
    <section className="bg-forest py-20 text-offwhite md:py-24">
      <div className="mx-auto max-w-editorial px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="dark">The Coordinated Host</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight md:text-4xl">
              How to host it better.
            </h2>
            <p className="mt-4 max-w-prose font-body text-lg leading-relaxed text-offwhite/80">
              Practical hosting help — how much ice you actually need, what to
              do the night before, and how to make the room work.
            </p>
          </div>

          <Link
            href="/coordinated-host"
            className="flex-shrink-0 border-b border-gold pb-0.5 font-body text-sm font-semibold uppercase tracking-[0.12em] text-offwhite transition-colors duration-400 hover:text-gold"
          >
            Read the latest &rarr;
          </Link>
        </div>

        {posts.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post._sys.filename}>
                <Link
                  href={`/coordinated-host/${post._sys.filename}`}
                  className="group block h-full overflow-hidden rounded-card border border-offwhite/15 bg-offwhite/5 transition-colors duration-400 hover:border-gold/60"
                >
                  {post.featuredImage && (
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={post.featuredImage}
                        alt={post.featuredImageAlt || ""}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-400 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    {post.franchise && post.franchise !== "None" && (
                      <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-gold">
                        {post.franchise}
                      </p>
                    )}
                    <h3 className="mt-2 font-display text-xl leading-snug">
                      {post.title}
                    </h3>
                    {post.deck && (
                      <p className="mt-2 font-body text-sm leading-relaxed text-offwhite/75">
                        {post.deck}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
