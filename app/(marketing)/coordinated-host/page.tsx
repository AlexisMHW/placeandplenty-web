import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/tina-content";

export const metadata: Metadata = {
  alternates: { canonical: "/coordinated-host" },
  openGraph: { url: "/coordinated-host" },
  title: "The Coordinated Host",
  description:
    "Practical help for having people over.",
};

export default async function CoordinatedHostPage() {
  const posts = await getAllPosts();

  return (
    <section className="bg-offwhite py-20 md:py-28">
      <div className="mx-auto max-w-prose px-6">
        <p className="mb-3 font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          by Place &amp; Plenty
        </p>
        <h1 className="font-display text-4xl text-forest">
          The Coordinated Host
        </h1>
        <p className="mt-4 font-body text-lg text-forest/80">
          Practical help for having people over.
        </p>

        {posts.length === 0 ? (
          <div className="mt-10 rounded-card border border-sage/30 bg-cream p-6 font-body text-sm text-forest/70">
            <p>
              New pieces are published through the season — host maths,
              timelines, and the things that actually decide whether an
              evening runs easily. Join the Guest List and they&rsquo;ll
              come to you.
            </p>
          </div>
        ) : (
          <ul className="mt-10 divide-y divide-sage/20">
            {posts.map((post: any) => (
              <li key={post._sys.filename} className="py-6">
                <Link
                  href={`/coordinated-host/${post._sys.filename}`}
                  className="font-display text-xl text-forest hover:text-sage"
                >
                  {post.title}
                </Link>
                {post.deck && (
                  <p className="mt-1 font-body text-sm text-forest/70">
                    {post.deck}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
