import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import { Display, Band } from "@/components/Display";
import type { Post } from "@/lib/tina-content";
import howManyDishes from "../homepage/article-how-many-dishes.png";
import nightBefore from "../homepage/article-night-before-list.png";
import potluck from "../homepage/article-potluck-without-group-chat.png";
import shopCupboards from "../homepage/article-shop-your-own-cupboards.png";
import wherePeopleStand from "../homepage/article-where-people-stand.png";

const ARTICLE_IMAGES: Record<string, StaticImageData> = {
  "how-many-dishes-is-enough": howManyDishes,
  "the-night-before-list": nightBefore,
  "how-to-organise-a-potluck": potluck,
  "shop-your-own-cupboards-first": shopCupboards,
  "where-people-actually-stand": wherePeopleStand,
};

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
          <ul className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {posts.slice(0, 3).map((post) => {
              const image = ARTICLE_IMAGES[post._sys.filename];
              return (
                <li key={post._sys.filename}>
                  <Link href={`/coordinated-host/${post._sys.filename}`} className="group flex h-full overflow-hidden rounded-card border border-sage/30 bg-parchment transition-shadow duration-400 hover:shadow-softer">
                    <div className="relative w-[38%] flex-shrink-0 overflow-hidden bg-forest">
                      {image ? (
                        <Image src={image} alt={post.featuredImageAlt || post.title} fill sizes="(min-width: 1024px) 12vw, 38vw" className="object-cover transition-transform duration-400 group-hover:scale-[1.04]" />
                      ) : null}
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
              );
            })}
          </ul>
        )}
      </div>
    </Band>
  );
}
