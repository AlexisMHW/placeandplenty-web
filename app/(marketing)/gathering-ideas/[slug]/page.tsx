import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import CtaButton from "@/components/CtaButton";
import RelatedRail from "@/components/RelatedRail";
import {
  getAllGatheringIdeas,
  getGatheringIdeaBySlug,
  relatedOf,
} from "@/lib/tina-content";
import { ArticleSchema } from "@/components/StructuredData";

// A single Gathering Idea. §14: each one should be able to connect to
// menu, look, setup, guest flow, prep, shopping, what to use from My
// Hosting Closet, relevant features, and relevant Coordinated Host
// articles — which is why the page ends with a related rail and a
// "Plan it in P&P" close rather than stopping at the body copy.

export async function generateStaticParams() {
  const ideas = await getAllGatheringIdeas();
  return ideas.map((idea) => ({ slug: idea._sys.filename }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const idea = await getGatheringIdeaBySlug(params.slug);
  if (!idea || idea.status !== "published") return {};

  // Self-canonicalising unless the piece was published elsewhere first
  // and the author pointed it there — see the note in app/layout.tsx.
  const canonical = idea.canonicalUrl || `/gathering-ideas/${params.slug}`;
  const description = idea.metaDescription || idea.deck || undefined;

  return {
    title: idea.seoTitle || idea.title,
    description,
    robots: idea.noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title: idea.seoTitle || idea.title,
      description: idea.socialDescription || description,
      url: canonical,
      type: "article",
      images: idea.heroImage ? [idea.heroImage] : undefined,
    },
  };
}

export default async function GatheringIdeaPage({
  params,
}: {
  params: { slug: string };
}) {
  const idea = await getGatheringIdeaBySlug(params.slug);

  // A draft must 404 rather than render, exactly as an unknown slug does.
  // Anything else would make an unlisted URL a way to read unpublished
  // work.
  if (!idea || idea.status !== "published") notFound();

  const { ideas: relatedIdeas, articles: relatedArticles } = relatedOf(idea);

  return (
    <>
      <ArticleSchema
        headline={idea.title}
        description={idea.metaDescription || idea.deck}
        url={`https://placeandplenty.com/gathering-ideas/${params.slug}`}
        image={idea.heroImage}
        datePublished={idea.publishDate}
      />
      <article>
        <header className="bg-parchment py-12 md:py-16">
          <div className="mx-auto max-w-prose px-6">
            <nav aria-label="Breadcrumb" className="font-body text-xs">
              <Link
                href="/gathering-ideas"
                className="text-forest/70 transition-colors duration-400 hover:text-forest"
              >
                Gathering Ideas
              </Link>
              {idea.season && idea.season !== "Any" && (
                <span className="text-forest/50"> · {idea.season}</span>
              )}
            </nav>

            <h1 className="mt-5 font-display text-4xl leading-tight text-forest md:text-5xl">
              {idea.title}
            </h1>

            {idea.deck && (
              <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
                {idea.deck}
              </p>
            )}
          </div>
        </header>

        {idea.heroImage && (
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
            <Image
              src={idea.heroImage}
              alt={idea.heroImageAlt || ""}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          </div>
        )}

        <div className="bg-offwhite py-14 md:py-20">
          <div className="mx-auto max-w-prose px-6">
            <div
              className="
                font-body text-lg leading-relaxed text-forest/85
                [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-forest
                [&_h3]:mt-8 [&_h3]:font-body [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-forest
                [&_p]:mt-5
                [&_ul]:mt-5 [&_ul]:space-y-2 [&_ul]:pl-5
                [&_ol]:mt-5 [&_ol]:space-y-2 [&_ol]:pl-5
                [&_li]:list-disc [&_li]:marker:text-gold
                [&_ol_li]:list-decimal
                [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-4
                [&_blockquote]:mt-8 [&_blockquote]:border-l-2 [&_blockquote]:border-gold [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-xl [&_blockquote]:italic
                [&_strong]:font-semibold [&_strong]:text-forest
              "
            >
              {idea.body ? (
                <TinaMarkdown content={idea.body} />
              ) : (
                <p>The full write-up for this one lands shortly.</p>
              )}
            </div>

            {idea.tags && idea.tags.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2">
                {idea.tags.filter(Boolean).map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-sage/40 px-3 py-1 font-body text-xs text-forest/70"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* "Plan It in P&P" — §15's recurring close. Only shown when the
            author wrote one, so it never reads as boilerplate. */}
        {idea.relatedProductMessage && (
          <section className="bg-forest py-14 text-offwhite md:py-16">
            <div className="mx-auto max-w-prose px-6">
              <span aria-hidden className="mb-4 block h-px w-8 bg-gold" />
              <p className="font-display text-2xl leading-snug">
                Plan it in Place &amp; Plenty.
              </p>
              <p className="mt-3 font-body text-base leading-relaxed text-offwhite/80">
                {idea.relatedProductMessage}
              </p>
              {idea.connectedFeature && (
                <p className="mt-3 font-body text-sm text-offwhite/65">
                  Starts in {idea.connectedFeature}.
                </p>
              )}
              <div className="mt-7">
                <CtaButton onDark />
              </div>
            </div>
          </section>
        )}
      </article>

      <RelatedRail ideas={relatedIdeas} articles={relatedArticles} />
    </>
  );
}
