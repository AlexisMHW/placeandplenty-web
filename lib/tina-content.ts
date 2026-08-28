// Wraps the client TinaCMS generates at build time (via `tinacms build`,
// which runs before `next build` — see package.json). Don't import
// tina/__generated__/client directly elsewhere; go through this file so
// there's one place to adjust if the generated path ever changes.
//
// WHERE CONTENT ACTUALLY COMES FROM. The generated client points at
// content.tinajs.io, not at the local filesystem. At build time this
// reads Tina Cloud's index of the GitHub branch — so a file edited in
// the working tree does not appear on a built page until it is pushed
// AND Tina Cloud has re-indexed it. `tinacms dev` runs a local server
// instead, which is the loop for drafting.
//
// TWO GATES, APPLIED HERE AND NOWHERE ELSE.
//
// 1. `status === "published"`. Every collection has it, and a draft must
//    never render — including a draft reached indirectly, as a homepage
//    seasonal card or a related-article link. Gating in the page
//    components instead would mean remembering it at ~10 call sites.
//
// 2. `consentConfirmed` on community stories. Directive §16: submission
//    is not blanket marketing consent, and permission has to cover
//    identifiable adults, children, private homes, photos and quotes. A
//    story without it does not render even if someone marks it
//    published. Two independent gates, deliberately — publishing is an
//    editorial act, consent is someone else's decision, and one must not
//    be able to stand in for the other.
//
// Everything exported from this file has already been through them.

// @ts-ignore — generated at build time, not present in source control
import { client } from "../tina/__generated__/client";
import type { TinaMarkdownContent } from "tinacms/dist/rich-text";

/* ------------------------------------------------------------------ */
/* Shapes                                                             */
/* ------------------------------------------------------------------ */

export interface TinaSys {
  _sys: { filename: string };
}

export interface GatheringIdea extends TinaSys {
  title: string;
  deck?: string | null;
  status?: string | null;
  publishDate?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  cardHeadline?: string | null;
  cardImage?: string | null;
  season?: string | null;
  occasion?: string | null;
  tags?: (string | null)[] | null;
  contentType?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  socialDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean | null;
  connectedFeature?: string | null;
  relatedProductMessage?: string | null;
  relatedArticles?: ({ article?: Post | null } | null)[] | null;
  relatedIdeas?: ({ idea?: GatheringIdea | null } | null)[] | null;
  body?: TinaMarkdownContent | TinaMarkdownContent[] | null;
}

export interface Post extends TinaSys {
  title: string;
  deck?: string | null;
  status?: string | null;
  byline?: string | null;
  publishDate?: string | null;
  updatedDate?: string | null;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  category?: string | null;
  franchise?: string | null;
  occasion?: string | null;
  tags?: (string | null)[] | null;
  contentType?: string | null;
  articleWeight?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  socialDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean | null;
  pinterestImage?: string | null;
  pinterestHeadline?: string | null;
  socialShareImage?: string | null;
  connectedFeature?: string | null;
  productCta?: string | null;
  relatedProductMessage?: string | null;
  featured?: boolean | null;
  contentHub?: string | null;
  shortAnswer?: string | null;
  relatedGatheringIdeas?: ({ idea?: GatheringIdea | null } | null)[] | null;
  relatedArticles?: ({ article?: Post | null } | null)[] | null;
  body?: TinaMarkdownContent | TinaMarkdownContent[] | null;
}

export interface CommunityStory extends TinaSys {
  title: string;
  status?: string | null;
  consentConfirmed?: boolean | null;
  contributorName?: string | null;
  gatheringType?: string | null;
  publishDate?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  whatWorked?: string | null;
  wouldDoDifferently?: string | null;
  helpedWith?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  socialDescription?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean | null;
  body?: TinaMarkdownContent | TinaMarkdownContent[] | null;
}

export interface Homepage {
  title?: string | null;
  reasonLine?: string | null;
  heroHeadline?: string | null;
  heroSubhead?: string | null;
  heroBody?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  ctaLabelOverride?: string | null;
  seasonalCards: GatheringIdea[];
  featuredGatheringIdeas: GatheringIdea[];
  featuredArticles: Post[];
  featuredCommunityStories: CommunityStory[];
}

/* ------------------------------------------------------------------ */
/* Gates                                                              */
/* ------------------------------------------------------------------ */

function isLive<T extends { status?: string | null }>(
  doc: T | null | undefined
): doc is T {
  return Boolean(doc && doc.status === "published");
}

function isLiveStory(
  doc: CommunityStory | null | undefined
): doc is CommunityStory {
  return Boolean(doc && doc.status === "published" && doc.consentConfirmed);
}

/**
 * Unwrap one of the `[{ idea: … }]` / `[{ article: … }]` object-lists the
 * schema uses instead of `list: true` on a reference. (`list: true` on a
 * reference generates a Connection type the document fragment cannot be
 * spread into, and Tina's codegen dies — see the note in tina/config.ts.)
 * Drops nulls, drops anything that fails its gate, and preserves the
 * editor's ordering.
 */
function unwrap<T>(
  list: (Record<string, unknown> | null)[] | null | undefined,
  key: string,
  gate: (d: unknown) => boolean
): T[] {
  return (list ?? [])
    .map((entry) => (entry ? (entry[key] as T | null) : null))
    .filter((doc): doc is T => gate(doc));
}

const liveGate = (d: unknown) =>
  isLive(d as { status?: string | null } | null | undefined);
const liveStoryGate = (d: unknown) =>
  isLiveStory(d as CommunityStory | null | undefined);

/* ------------------------------------------------------------------ */
/* Homepage                                                           */
/* ------------------------------------------------------------------ */

interface RawHomepage {
  title?: string | null;
  reasonLine?: string | null;
  heroHeadline?: string | null;
  heroSubhead?: string | null;
  heroBody?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  ctaLabelOverride?: string | null;
  seasonalCards?: (Record<string, unknown> | null)[] | null;
  featuredGatheringIdeas?: (Record<string, unknown> | null)[] | null;
  featuredArticles?: (Record<string, unknown> | null)[] | null;
  featuredCommunityStories?: (Record<string, unknown> | null)[] | null;
}

export async function getHomepage(): Promise<Homepage> {
  const result = await client.queries.homepage({ relativePath: "home.json" });
  // The raw document, before the reference lists are unwrapped and
  // gated. Scalars come through as-is; the four reference lists are
  // object-lists whose single key holds the referenced document.
  const doc = result.data.homepage as unknown as RawHomepage;

  return {
    title: doc.title,
    reasonLine: doc.reasonLine,
    heroHeadline: doc.heroHeadline,
    heroSubhead: doc.heroSubhead,
    heroBody: doc.heroBody,
    heroImage: doc.heroImage,
    heroImageAlt: doc.heroImageAlt,
    ctaLabelOverride: doc.ctaLabelOverride,
    seasonalCards: unwrap<GatheringIdea>(doc.seasonalCards, "idea", liveGate),
    featuredGatheringIdeas: unwrap<GatheringIdea>(
      doc.featuredGatheringIdeas,
      "idea",
      liveGate
    ),
    featuredArticles: unwrap<Post>(doc.featuredArticles, "article", liveGate),
    featuredCommunityStories: unwrap<CommunityStory>(
      doc.featuredCommunityStories,
      "story",
      liveStoryGate
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Collections                                                        */
/* ------------------------------------------------------------------ */

/** Newest first, with undated pieces last rather than sorted as epoch 0. */
function byPublishDateDesc<T extends { publishDate?: string | null }>(
  a: T,
  b: T
): number {
  if (!a.publishDate && !b.publishDate) return 0;
  if (!a.publishDate) return 1;
  if (!b.publishDate) return -1;
  return b.publishDate.localeCompare(a.publishDate);
}

/*
 * WHY THE CONNECTION READERS CAST.
 *
 * tina/__generated__/types.ts is a build artifact and is not in source
 * control, so its exact shape is not a contract this file can depend on:
 * it carries __typename and id, marks `status` required where the
 * schema allows it to be absent, and regenerates on every build. The
 * interfaces above ARE the contract — they are what every page consumes.
 *
 * So the generated edge is narrowed to those interfaces once, here, at
 * the single boundary where data enters. Everything downstream is fully
 * typed. Widening the interfaces to match the generated types instead
 * would put build-artifact noise into every page component and break the
 * moment Tina's codegen changes shape.
 */
export async function getAllPosts(): Promise<Post[]> {
  const result = await client.queries.postConnection();
  const edges = (result.data.postConnection.edges ?? []) as ({
    node?: Post | null;
  } | null)[];
  return edges
    .map((edge) => edge?.node)
    .filter((n): n is Post => isLive(n))
    .sort(byPublishDateDesc);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const result = await client.queries.post({ relativePath: `${slug}.mdx` });
    return result.data.post as unknown as Post;
  } catch {
    // Tina throws rather than returning null for a path that is not a
    // document. A bad slug is a 404, not a 500.
    return null;
  }
}

export async function getAllGatheringIdeas(): Promise<GatheringIdea[]> {
  const result = await client.queries.gatheringIdeaConnection();
  const edges = (result.data.gatheringIdeaConnection.edges ?? []) as ({
    node?: GatheringIdea | null;
  } | null)[];
  return edges
    .map((edge) => edge?.node)
    .filter((n): n is GatheringIdea => isLive(n))
    .sort(byPublishDateDesc);
}

export async function getGatheringIdeaBySlug(
  slug: string
): Promise<GatheringIdea | null> {
  try {
    const result = await client.queries.gatheringIdea({
      relativePath: `${slug}.mdx`,
    });
    return result.data.gatheringIdea as unknown as GatheringIdea;
  } catch {
    return null;
  }
}

export async function getAllCommunityStories(): Promise<CommunityStory[]> {
  const result = await client.queries.communityStoryConnection();
  const edges = (result.data.communityStoryConnection.edges ?? []) as ({
    node?: CommunityStory | null;
  } | null)[];
  return edges
    .map((edge) => edge?.node)
    .filter((n): n is CommunityStory => isLiveStory(n))
    .sort(byPublishDateDesc);
}

export async function getCommunityStoryBySlug(
  slug: string
): Promise<CommunityStory | null> {
  try {
    const result = await client.queries.communityStory({
      relativePath: `${slug}.mdx`,
    });
    return result.data.communityStory as unknown as CommunityStory;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers used by the page components                                */
/* ------------------------------------------------------------------ */

/** What a Gathering Idea card should show, hero as the fallback. */
export function ideaCard(idea: GatheringIdea) {
  return {
    href: `/gathering-ideas/${idea._sys.filename}`,
    headline: idea.cardHeadline || idea.title,
    image: idea.cardImage || idea.heroImage || null,
    // A card image is decorative when the headline beside it already says
    // the same thing; an alt repeating the title is noise to a screen
    // reader. Only a genuinely descriptive alt is passed through.
    imageAlt: idea.cardImage ? "" : idea.heroImageAlt || "",
    deck: idea.deck || null,
  };
}

/** Related items, already gated, flattened, and free of self-references. */
export function relatedOf(doc: GatheringIdea | Post) {
  const rawIdeas =
    (doc as GatheringIdea).relatedIdeas ??
    (doc as Post).relatedGatheringIdeas ??
    null;

  const ideas = unwrap<GatheringIdea>(
    rawIdeas as (Record<string, unknown> | null)[] | null,
    "idea",
    liveGate
  ).filter((d) => d._sys.filename !== doc._sys.filename);

  const articles = unwrap<Post>(
    doc.relatedArticles as (Record<string, unknown> | null)[] | null,
    "article",
    liveGate
  ).filter((d) => d._sys.filename !== doc._sys.filename);

  return { ideas, articles };
}
