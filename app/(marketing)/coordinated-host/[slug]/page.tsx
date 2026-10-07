import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { getAllPosts, getPostBySlug, articleImage, relatedOf } from "@/lib/tina-content";
import { ArticleSchema, BreadcrumbSchema } from "@/components/StructuredData";
import { APP_DOWNLOAD_PATH, hasAnyStoreLink } from "@/lib/app-links";
import { FOUNDER_PHOTO } from "@/lib/founder";
import Photo from "@/components/Photo";

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
    keywords: post.tags?.filter((tag): tag is string => Boolean(tag)),
    authors: [{ name: "Alexis Hughes-Williams", url: "https://placeandplenty.com/about" }],
    robots: post.noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.socialDescription || post.metaDescription || post.deck || undefined,
      url: canonical,
      type: "article",
      authors: ["https://placeandplenty.com/about"],
      section: post.category || undefined,
      tags: post.tags?.filter((tag): tag is string => Boolean(tag)),
      publishedTime: post.publishDate || undefined,
      modifiedTime: post.updatedDate || post.publishDate || undefined,
      images: [{ url: post.socialShareImage || articleImage(post), alt: post.featuredImageAlt || post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description: post.socialDescription || post.metaDescription || post.deck || undefined,
      images: [post.socialShareImage || articleImage(post)],
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

  const related = relatedOf(post);
  const isHoliday = post.contentHub === "holiday-less-spending";

  return (
    <>
      <BreadcrumbSchema items={[
        { name: "Home", url: "https://placeandplenty.com" },
        { name: "The Coordinated Host", url: "https://placeandplenty.com/coordinated-host" },
        { name: post.title, url: `https://placeandplenty.com/coordinated-host/${params.slug}` },
      ]} />
      <ArticleSchema
        headline={post.title}
        description={post.metaDescription || post.deck}
        url={`https://placeandplenty.com/coordinated-host/${params.slug}`}
        image={articleImage(post)}
        datePublished={post.publishDate}
        dateModified={post.updatedDate}
      />
      <article className="bg-offwhite py-16 md:py-24">
      <div className="mx-auto max-w-prose px-6">
        <nav aria-label="Breadcrumb" className="font-body text-xs text-forest/70">
          <Link href="/" className="hover:text-forest">Home</Link><span> · </span>
          <Link href="/coordinated-host" className="hover:text-forest">
            The Coordinated Host
          </Link>
          {post.category && <span> · {post.category}</span>}
        </nav>

        {isHoliday && <Link href="/coordinated-host#holiday-series" className="mt-6 block font-body text-sm font-bold text-goldInk underline underline-offset-4">A Little Less Spending. A Lot More Holiday.</Link>}

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

        {/* The same photograph the journal lead and the grid card carry —
            resolved through articleImage() so the three can never
            disagree about which picture this piece is. */}
        <Photo
          src={articleImage(post)}
          alt={post.featuredImageAlt || post.title}
          caption={post.featuredImageAlt || `${post.title} — a real home, warm natural light`}
          tone="forest"
          className="mt-8 aspect-[16/10] w-full rounded-card"
          sizes="(min-width: 768px) 65ch, 100vw"
          priority
        />

        {post.shortAnswer && (
          <div className="mt-8 rounded-card border border-gold bg-cream p-6">
            <p className="font-body text-xs font-bold uppercase tracking-wide text-forest/60">
              The Short Answer
            </p>
            <p className="mt-2 font-body text-forest">{post.shortAnswer}</p>
          </div>
        )}

        <div className="article-body mt-10 max-w-none font-body text-forest/90">
          {post.body && <TinaMarkdown content={post.body} />}
        </div>

        {post.relatedProductMessage && (
          <div className="mt-14 rounded-card border border-sage/30 bg-forest p-6 text-offwhite">
            <p className="font-display text-lg">Less scrambling. More gathering.</p>
            <p className="mt-2 font-body text-sm text-offwhite/80">
              {post.relatedProductMessage}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/signup?next=%2Fhost%2Fcreate" className="rounded-lg bg-gold px-5 py-3 font-body text-sm font-bold text-forest">Start a gathering now</Link>
              {hasAnyStoreLink() && <Link href={APP_DOWNLOAD_PATH} className="rounded-lg border border-offwhite/50 px-5 py-3 font-body text-sm font-bold text-offwhite">Download the app</Link>}
              <Link href="/gathering-checklists" className="px-2 py-3 font-body text-sm text-offwhite underline underline-offset-4">Get a free hosting checklist</Link>
            </div>
          </div>
        )}
        {post.tags?.length ? <ul aria-label="Article topics" className="mt-8 flex flex-wrap gap-2">{post.tags.filter(Boolean).map((tag) => <li key={tag} className="rounded-full border border-sage/30 bg-parchment px-3 py-1 font-body text-xs text-forest">{tag}</li>)}</ul> : null}
        {isHoliday && <aside className="mt-10 flex items-center gap-5 border-y border-gold/50 py-6" aria-label="About the author">
          <Photo src={FOUNDER_PHOTO.src} alt={FOUNDER_PHOTO.alt} className="h-24 w-24 shrink-0 rounded-full" sizes="96px" />
          <div><Link href="/about" className="font-display text-lg text-forest underline underline-offset-4">Alexis Hughes-Williams</Link><p className="mt-2 font-body text-sm leading-relaxed text-forest/80">Founder of Place &amp; Plenty. Practical hosting ideas for real homes, busy families, and the people around your table.</p></div>
        </aside>}
        {related.articles.length > 0 && <nav aria-label="Related articles" className="mt-12">
          <h2 className="font-display text-2xl text-forest">Keep the ideas going</h2>
          <ul className="mt-5 space-y-4">{related.articles.map((article) => <li key={article._sys.filename}><Link href={`/coordinated-host/${article._sys.filename}`} className="font-body text-forest underline decoration-gold decoration-2 underline-offset-4">{article.title}</Link></li>)}</ul>
        </nav>}
        </div>
      </article>
    </>
  );
}
