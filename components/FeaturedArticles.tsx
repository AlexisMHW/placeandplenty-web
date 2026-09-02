import Link from "next/link";
import Image from "next/image";
import { Display, Band } from "@/components/Display";
import type { Post } from "@/lib/tina-content";

// The approved feature photos now live in `public/images` so that Tina
// can address them by URL — the frontmatter is the canonical source and
// a bundler import cannot be written into a .mdx file. See the same note
// in app/(marketing)/coordinated-host/page.tsx.
const ARTICLE_FALLBACKS = [
  "/images/article-how-many-dishes.png",
  "/images/article-night-before-list.png",
  "/images/article-how-to-organise-a-potluck.png",
  "/images/article-shop-your-own-cupboards.png",
  "/images/article-where-people-stand.png",
];

export default function FeaturedArticles({ posts }: { posts: Post[] }) {
  return (
    <Band tone="plain">
      <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Display emphasis="inspiration" className="text-3xl leading-tight text-forest md:text-4xl">
            Gathering ideas & inspiration
          </Display>

          <Link href="/coordinated-host" className="border-b border-gold pb-0.5 font-body text-xs font-semibold uppercase tracking-[0.16em] text-forest transition-colors duration-400 hover:text-sage">
            View all articles &rarr;
          </Link>
        </div>

        {posts.length > 0 && (
          <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {posts.slice(0, 4).map((post, index) => {
              // Never reserve a photo frame and leave it empty. The article's
              // own Tina image wins; new editorial posts can ship before a
              // bespoke card image is assigned, so a warm hosting image stands
              // in until the final article art exists.
              const image = post.featuredImage || ARTICLE_FALLBACKS[index % ARTICLE_FALLBACKS.length];
              return (
                <li key={post._sys.filename}>
                  <Link href={`/coordinated-host/${post._sys.filename}`} className="group flex h-full flex-col overflow-hidden rounded-card border border-sage/30 bg-parchment transition-shadow duration-400 hover:shadow-softer">
                    <div className="relative aspect-[4/3] overflow-hidden bg-forest">
                      <Image src={image} alt={post.featuredImageAlt || post.title} fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-400 group-hover:scale-[1.04]" />
                    </div>

                    <div className="flex flex-1 flex-col justify-center p-5">
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
              );
            })}
          </ul>
        )}
      </div>
    </Band>
  );
}
