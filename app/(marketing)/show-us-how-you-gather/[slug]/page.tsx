import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import {
  getAllCommunityStories,
  getCommunityStoryBySlug,
} from "@/lib/tina-content";

// One community story.
//
// BOTH GATES APPLY HERE TOO, and they are re-stated rather than assumed.
// getAllCommunityStories() is already filtered, so a story without
// consent never gets a prerendered route — but a direct request to a
// guessed URL bypasses generateStaticParams entirely and lands straight
// in this component. So the check below is not redundant with the list:
// it is the one that stops an unpublished or unconsented story from being
// readable by anyone who types its slug.

export async function generateStaticParams() {
  const stories = await getAllCommunityStories();
  return stories.map((story) => ({ slug: story._sys.filename }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const story = await getCommunityStoryBySlug(params.slug);
  if (!story || story.status !== "published" || !story.consentConfirmed) {
    return {};
  }

  const canonical =
    story.canonicalUrl || `/show-us-how-you-gather/${params.slug}`;
  const description =
    story.metaDescription ||
    story.whatWorked ||
    "A real gathering, shared by the person who hosted it.";

  return {
    title: story.seoTitle || story.title,
    description,
    robots: story.noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    openGraph: {
      title: story.seoTitle || story.title,
      description: story.socialDescription || description,
      url: canonical,
      type: "article",
      images: story.heroImage ? [story.heroImage] : undefined,
    },
  };
}

export default async function CommunityStoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const story = await getCommunityStoryBySlug(params.slug);

  if (!story || story.status !== "published" || !story.consentConfirmed) {
    notFound();
  }

  const sections = [
    { heading: "What worked", body: story.whatWorked },
    { heading: "What they'd do differently", body: story.wouldDoDifferently },
    { heading: "What Place & Plenty helped with", body: story.helpedWith },
  ].filter((s) => s.body);

  return (
    <article>
      <header className="bg-parchment py-12 md:py-16">
        <div className="mx-auto max-w-prose px-6">
          <nav aria-label="Breadcrumb" className="font-body text-xs">
            <Link
              href="/show-us-how-you-gather"
              className="text-forest/70 transition-colors duration-400 hover:text-forest"
            >
              Show Us How You Gather
            </Link>
            {story.gatheringType && (
              <span className="text-forest/50"> · {story.gatheringType}</span>
            )}
          </nav>

          <h1 className="mt-5 font-display text-4xl leading-tight text-forest md:text-5xl">
            {story.title}
          </h1>

          {/* Unattributed is a legitimate outcome, not missing data —
              someone can agree to their table being shown without
              agreeing to be named. No fallback byline. */}
          {story.contributorName && (
            <p className="mt-4 font-body text-base text-forest/70">
              from {story.contributorName}
            </p>
          )}
        </div>
      </header>

      {story.heroImage && (
        <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
          <Image
            src={story.heroImage}
            alt={story.heroImageAlt || ""}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>
      )}

      <div className="bg-offwhite py-14 md:py-20">
        <div className="mx-auto max-w-prose px-6">
          {story.body && (
            <div
              className="
                font-body text-lg leading-relaxed text-forest/85
                [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-forest
                [&_p]:mt-5
                [&_ul]:mt-5 [&_ul]:space-y-2 [&_ul]:pl-5
                [&_li]:list-disc [&_li]:marker:text-gold
                [&_a]:underline [&_a]:decoration-gold [&_a]:underline-offset-4
                [&_strong]:font-semibold [&_strong]:text-forest
              "
            >
              <TinaMarkdown content={story.body} />
            </div>
          )}

          {sections.length > 0 && (
            <dl className="mt-12 space-y-8 border-t border-sage/25 pt-10">
              {sections.map((section) => (
                <div key={section.heading}>
                  <dt className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/75">
                    {section.heading}
                  </dt>
                  <dd className="mt-2 font-body text-lg leading-relaxed text-forest/85">
                    {section.body}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-14 rounded-card border border-sage/30 bg-cream p-6">
            <p className="font-display text-xl text-forest">
              Your gathering counts too.
            </p>
            <p className="mt-2 font-body text-base leading-relaxed text-forest/80">
              Real homes, real tables, real people.{" "}
              <Link
                href="/show-us-how-you-gather"
                className="underline decoration-gold underline-offset-4 hover:text-forest"
              >
                Show us how you gather
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
