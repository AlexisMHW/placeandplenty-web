import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import DifferenceBand from "@/components/DifferenceBand";
import ConnectedBand from "@/components/ConnectedBand";
import FeaturedArticles from "@/components/FeaturedArticles";
import CommunityTeaser from "@/components/CommunityTeaser";
import FounderBand from "@/components/FounderBand";
import CtaBand from "@/components/CtaBand";
import { getHomepage, getAllPosts, getAllGatheringIdeas } from "@/lib/tina-content";
import { OrganizationSchema } from "@/components/StructuredData";

// THE HOMEPAGE, composed to `Home_Page.png`.
//
// The reference's bands, in its order:
//
//   SeasonalHero     brand line over a full-bleed photograph
//   SeasonalCards    "Reasons people are hosting right now" + four cards
//   DifferenceBand   "The hosting platform built for real life" + the
//                    eight-item difference grid + the invitation line
//   ConnectedBand    "One seamless experience. Web and app, connected."
//                    and the four conversion paths
//   FeaturedArticles the editorial rail
//   CommunityTeaser  Show Us How You Gather
//   FounderBand      "Hi, I'm Alexis."
//   CtaBand          the close
//
// FOUR SECTIONS WERE REMOVED FROM THIS PAGE and it is the most important
// change on it. §5 of the visual directive: "Do not create endless-scroll
// pages... Use fewer, stronger sections... More presence. Less
// scrolling." The homepage was carrying HostingRealitySection (which is
// /how-it-works), a pricing block (which is /pricing, and in the primary
// nav), and a second closing CTA on top of the first. Duplicating a
// subpage on the homepage is exactly what §5 forbids, and each copy was
// a reason for a visitor never to reach the real page.
//
// The reference is eight bands. So is this. Every one has a pathway out.
//
// EVERY BAND EXCEPT THE HERO IS INSET (see Band in components/Display).
// Sections sit as panels on the cream page ground with a margin and soft
// corners — the reference's most distinctive structural move, and the
// thing that separates editorial composition from a stack of full-width
// stripes. The hero is full-bleed because a photograph that stops short
// of the edge stops being an establishing shot.
//
// PRODUCT TRUTH OVERRIDES THE REFERENCE WHERE THEY DISAGREE. The
// reference's grid says "My Shopping List" (§9/§32: My Shopping), its
// Space Mode copy describes the guest experience rather than Space Mode,
// its header offers two separate sign-ins where there is one identity,
// and its footer links to Careers, Press and a Help Center that do not
// exist. Composition, weight, photography, botanicals and pacing come
// from the reference; names and claims come from the reconciliation.
//
// SEASONAL CONTENT IS STILL CONTENT (§6, §13). Hero words and
// photograph, the four cards, featured articles and community stories
// are Tina fields, so a fall-to-holiday rotation is picks in the editor.
// The order lives here because §6 keeps structure in code and there is
// no page builder.

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const [content, allPosts, allIdeas] = await Promise.all([
    getHomepage(),
    getAllPosts(),
    getAllGatheringIdeas(),
  ]);

  // Featured ideas are a separate Tina list from the seasonal cards, so
  // an evergreen idea can be promoted without displacing a seasonal one.
  // Showing the same idea twice reads as a mistake rather than emphasis.
  const seasonalSlugs = new Set(
    content.seasonalCards.map((i) => i._sys.filename)
  );
  const extraIdeas = content.featuredGatheringIdeas.filter(
    (i) => !seasonalSlugs.has(i._sys.filename)
  );

  // THE EDITORIAL RAIL FALLS BACK TO WHAT IS PUBLISHED. Tina's
  // featuredArticles list is a curation, and it is currently empty —
  // which rendered a band with a heading, a "view all" link and no
  // articles at all. An empty section that announces itself is worse
  // than no section, and worse still when there ARE three published
  // pieces one click away. A founder picking favourites overrides this;
  // picking none now means "the newest three" rather than "nothing".
  const railPosts =
    content.featuredArticles.length > 0
      ? content.featuredArticles
      : allPosts.slice(0, 3);

  // Same reasoning for the seasonal cards: if nobody has picked any, the
  // homepage shows what exists rather than dropping its most important
  // band on the floor.
  const cards =
    content.seasonalCards.length > 0
      ? [...content.seasonalCards, ...extraIdeas]
      : allIdeas.slice(0, 4);

  return (
    <>
      <OrganizationSchema />

      <SeasonalHero content={content} />
      <SeasonalCards ideas={cards} reasonLine={content.reasonLine} />

      <DifferenceBand />
      <ConnectedBand />

      <FeaturedArticles posts={railPosts} />
      <CommunityTeaser stories={content.featuredCommunityStories} />

      <FounderBand
        eyebrow="Founder & host"
        headline="Hi, I’m Alexis. I built Place & Plenty for hosts like you."
        body="I’ve always believed the best memories happen around the table. But hosting? It can be a lot. Place & Plenty is the tool I wished I had — to plan with confidence, stay organised, and be present with my people."
        linkLabel="Read my story"
        tone="cream"
      />

      <CtaBand
        headline="Ready to host"
        emphasisLine="with ease?"
        body="Create a free account and plan your next gathering in the browser. Same account in the app, whenever you want it there."
      />
    </>
  );
}
