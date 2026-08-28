import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { getAllPosts, getPostBySlug } from "@/lib/tina-content";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post: any) => ({ slug: post._sys.filename }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post || post.status !== "published") return {};

  // Articles self-canonicalise to their own URL unless the author has
  // deliberately pointed one elsewhere via the Tina `canonicalUrl` field
  // (used when the same piece is syndicated). See app/layout.tsx.
  const canonical = post.canonicalUrl || `/coordinated-host/${params.slug}`;

  return {
    title: post.seoTitle || post.title,
    description: post.metaDescription || post.deck,
    robots: post.noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.socialDescription || post.metaDescription || post.deck || undefined,
      url: canonical,
      type: "article",
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPostBySlug(params.slug);

  if (!post || post.status !== "published") {
    notFound();
  }

  return (
    <article className="bg-offwhite py-16 md:py-24">
      <div className="mx-auto max-w-prose px-6">
        <nav className="font-body text-xs text-forest/60">
          <Link href="/coordinated-host" className="hover:text-forest">
            The Coordinated Host
          </Link>
          {post.category && <span> · {post.category}</span>}
        </nav>

        {post.franchise && post.franchise !== "None" && (
          <p className="mt-6 font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
            {post.franchise}
          </p>
        )}

        <h1 className="mt-3 font-display text-4xl leading-tight text-forest md:text-5xl">
          {post.title}
        </h1>

        {post.deck && (
          <p className="mt-4 font-body text-lg text-forest/80">{post.deck}</p>
        )}

        <p className="mt-6 font-body text-xs uppercase tracking-wide text-forest/50">
          {post.byline || "The Coordinated Host by Place & Plenty"}
          {post.publishDate &&
            ` · ${new Date(post.publishDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}`}
        </p>

        {post.shortAnswer && (
          <div className="mt-8 rounded-card border border-gold bg-cream p-6">
            <p className="font-body text-xs font-bold uppercase tracking-wide text-forest/60">
              The Short Answer
            </p>
            <p className="mt-2 font-body text-forest">{post.shortAnswer}</p>
          </div>
        )}

        <div className="prose prose-forest mt-10 max-w-none font-body text-forest/90">
          {post.body && <TinaMarkdown content={post.body} />}
        </div>

        {post.relatedProductMessage && (
          <div className="mt-14 rounded-card border border-sage/30 bg-forest p-6 text-offwhite">
            <p className="font-display text-lg">Less scrambling. More gathering.</p>
            <p className="mt-2 font-body text-sm text-offwhite/80">
              {post.relatedProductMessage}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
