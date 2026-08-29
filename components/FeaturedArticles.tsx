import Link from "next/link";
import Image from "next/image";
import { Display, Band } from "@/components/Display";
import { BotanicalCorner } from "@/components/Botanical";
import type { Post } from "@/lib/tina-content";

// "Gathering ideas & inspiration" — the reference's editorial rail.
//
// HORIZONTAL CARDS: image left, text right, three across. That is the
// reference's construction and it is the right one for editorial — a
// headline gets to be a headline rather than a caption squeezed under a
// square, and three of them read as a contents page rather than as
// tiles.
//
// §15 keeps The Coordinated Host and Gathering Ideas distinct — "how do
// I host this better?" against "what should we gather for?" — so this
// rail carries the FRANCHISE as its kicker (Host Math, Before They
// Arrive), which is the thing that signals which of the two you are
// reading.
//
// Renders the invitation to the section even with nothing featured,
// because The Coordinated Host is a standing destination in the nav and
// a visitor who has seen the name should be able to reach it.

export default function FeaturedArticles({ posts }: { posts: Post[] }) {
  return (
    <Band tone="plain">
      <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Display
            emphasis="inspiration"
            className="text-3xl leading-tight text-forest md:text-4xl"
          >
            Gathering ideas & inspiration
          </Display>

          <Link
            href="/coordinated-host"
            className="border-b border-gold pb-0.5 font-body text-xs font-semibold uppercase tracking-[0.16em] text-forest transition-colors duration-400 hover:text-sage"
          >
            View all articles &rarr;
          </Link>
        </div>

        {posts.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {posts.slice(0, 3).map((post) => (
              <li key={post._sys.filename}>
                <Link
                  href={`/coordinated-host/${post._sys.filename}`}
                  className="group flex h-full overflow-hidden rounded-card border border-sage/30 bg-parchment transition-shadow duration-400 hover:shadow-softer"
                >
                  <div className="relative w-[38%] flex-shrink-0 overflow-hidden bg-forest">
                    {post.featuredImage ? (
                      <Image
                        src={post.featuredImage}
                        alt={post.featuredImageAlt || ""}
                        fill
                        sizes="(min-width: 1024px) 12vw, 38vw"
                        className="object-cover transition-transform duration-400 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <>
                        <div
                          aria-hidden
                          className="absolute inset-0 bg-gradient-to-br from-forest to-sage/40"
                        />
                        <BotanicalCorner
                          className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-offwhite"
                          size={92}
                        />
                      </>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
                    {post.franchise && post.franchise !== "None" && (
                      <p className="font-body text-[0.65rem] font-bold uppercase tracking-[0.16em] text-forest/60">
                        {post.franchise}
                      </p>
                    )}
                    <h3 className="mt-1.5 font-display text-lg leading-snug text-forest transition-colors duration-400 group-hover:text-sage">
                      {post.title}
                    </h3>
                    <span className="mt-3 font-body text-xs font-semibold text-forest/70">
                      Read more <span aria-hidden>&rarr;</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Band>
  );
}
