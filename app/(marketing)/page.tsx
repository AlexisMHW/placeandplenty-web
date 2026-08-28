import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import PromiseBand from "@/components/PromiseBand";
import HostingRealitySection from "@/components/HostingRealitySection";
import GuestManagementSection from "@/components/GuestManagementSection";
import FeatureGrid from "@/components/FeatureGrid";
import FounderNote from "@/components/FounderNote";
import FeaturedArticles from "@/components/FeaturedArticles";
import CommunityTeaser from "@/components/CommunityTeaser";
import PricingSection from "@/components/PricingSection";
import CtaSection from "@/components/CtaSection";
import { getHomepage } from "@/lib/tina-content";
import { getCurrentCta } from "@/lib/launch-state";
import { OrganizationSchema } from "@/components/StructuredData";

// THE HOMEPAGE. Its job is to INTRODUCE and HAND OFF — not to restate
// the site. Beginning, middle, end.
//
//   introduce      SeasonalHero, SeasonalCards   -> Gathering Ideas
//   the story      PromiseBand
//   the turn       HostingRealitySection         -> How It Works
//   the difference GuestManagementSection        -> What It Does
//   the product    FeatureGrid                   -> What It Does
//   proof          FeaturedArticles              -> The Coordinated Host
//                  CommunityTeaser               -> Show Us How You Gather
//                  FounderNote                   -> About
//   convert        PricingSection (launch-gated) -> Pricing
//                  CtaSection
//
// WHAT WAS REMOVED, AND WHY. The page previously also carried HowItWorks
// (the full four steps, which /how-it-works exists for) and
// HostReadySection (a long explainer that appears on BOTH /how-it-works
// and /what-it-does). Three full sections of the homepage were verbatim
// copies of pages one click away, which is how a homepage becomes an
// endless scroll that still says nothing a visitor could not get better
// elsewhere.
//
// HostingRealitySection and GuestManagementSection now render in
// `compact` form here: the homepage takes the sharp version and links
// on, while the pages that are genuinely about those subjects keep the
// full treatment. Same components, no duplicated copy to drift.
//
// EVERY SECTION EXITS SOMEWHERE. That is the rule this page is built on
// — a section with no pathway out is a dead end, and enough of them in a
// row is just scrolling.
//
// §6/§13 — SEASONAL CONTENT IS CONTENT, NOT CODE. Hero words and
// photograph, the four seasonal cards, featured articles and featured
// community stories all come from Tina, so rotating fall to holiday is
// picks in the editor. The section ORDER stays here: §6 keeps structure,
// layout and order in code, and there is no page builder.

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const content = await getHomepage();
  const { showPricing } = getCurrentCta();

  // Featured ideas are a separate Tina list from the seasonal cards, so
  // the founder can promote an evergreen idea without displacing a
  // seasonal one. Showing the same idea twice on one page reads as a
  // mistake rather than emphasis.
  const seasonalSlugs = new Set(
    content.seasonalCards.map((i) => i._sys.filename)
  );
  const extraIdeas = content.featuredGatheringIdeas.filter(
    (i) => !seasonalSlugs.has(i._sys.filename)
  );

  return (
    <>
      <OrganizationSchema />

      <SeasonalHero content={content} />
      <SeasonalCards ideas={[...content.seasonalCards, ...extraIdeas]} />
      <PromiseBand />

      <HostingRealitySection compact />
      <GuestManagementSection compact />
      <FeatureGrid />

      <FeaturedArticles posts={content.featuredArticles} />
      <CommunityTeaser stories={content.featuredCommunityStories} />
      <FounderNote />

      {showPricing && <PricingSection />}
      <CtaSection />
    </>
  );
}
