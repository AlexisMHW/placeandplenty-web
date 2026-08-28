import Link from "next/link";
import type { GatheringIdea, Post } from "@/lib/tina-content";

// The cross-link rail at the foot of an idea or an article.
//
// §15: "Gathering Ideas and The Coordinated Host should cross-link
// naturally", and §19 wants the two to form a useful internal content
// network. Both are listed here, but LABELLED SEPARATELY rather than
// mixed into one list of related links — the distinction between "what
// should we gather for" and "how do I host this better" is the thing that
// keeps either section from becoming a generic blog, and blurring it in
// the navigation would undo that.
//
// Everything arriving here has been through the published gate in
// lib/tina-content.ts and had self-references stripped.

export default function RelatedRail({
  ideas,
  articles,
}: {
  ideas: GatheringIdea[];
  articles: Post[];
}) {
  if (ideas.length === 0 && articles.length === 0) return null;

  return (
    <section className="border-t border-sage/25 bg-offwhite py-14 md:py-16">
      <div className="mx-auto grid max-w-editorial gap-10 px-6 md:grid-cols-2">
        {ideas.length > 0 && (
          <div>
            <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
              More Gathering Ideas
            </h2>
            <ul className="mt-5 space-y-4">
              {ideas.map((idea) => (
                <li key={idea._sys.filename}>
                  <Link
                    href={`/gathering-ideas/${idea._sys.filename}`}
                    className="font-display text-xl leading-snug text-forest transition-colors duration-400 hover:text-sage"
                  >
                    {idea.title}
                  </Link>
                  {idea.deck && (
                    <p className="mt-1 font-body text-sm leading-relaxed text-forest/70">
                      {idea.deck}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {articles.length > 0 && (
          <div>
            <h2 className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
              From The Coordinated Host
            </h2>
            <ul className="mt-5 space-y-4">
              {articles.map((post) => (
                <li key={post._sys.filename}>
                  <Link
                    href={`/coordinated-host/${post._sys.filename}`}
                    className="font-display text-xl leading-snug text-forest transition-colors duration-400 hover:text-sage"
                  >
                    {post.title}
                  </Link>
                  {post.deck && (
                    <p className="mt-1 font-body text-sm leading-relaxed text-forest/70">
                      {post.deck}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
