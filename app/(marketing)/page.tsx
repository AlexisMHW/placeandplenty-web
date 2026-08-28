import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import PromiseBand from "@/components/PromiseBand";
import HowItWorks from "@/components/HowItWorks";
import FeatureGrid from "@/components/FeatureGrid";
import HostReadySection from "@/components/HostReadySection";
import FounderNote from "@/components/FounderNote";
import FeaturedArticles from "@/components/FeaturedArticles";
import CommunityTeaser from "@/components/CommunityTeaser";
import PricingSection from "@/components/PricingSection";
import CtaSection from "@/components/CtaSection";
import { getHomepage } from "@/lib/tina-content";
import { getCurrentCta } from "@/lib/launch-state";

// THE HOMEPAGE. Two rules govern its shape and they pull in opposite
// directions, so both are worth stating.
//
// §12 — it is built around "Reasons people are hosting right now", which
// is broader than holidays. The hero and the cards under it are that.
//
// §13 — it must be EASY TO CHANGE. Seasonal content must not be
// hard-coded into structural components, and the founder must be able to
// swap it without Claude Code. So the page is a fixed sequence of
// sections, and what fills the seasonal ones comes from Tina: the hero
// words and photograph, the four seasonal cards, the featured articles
// and the featured community stories.
//
// That is the whole design. The section ORDER is code, the CONTENT is
// content, and there is deliberately no page builder — §23 asks for
// "editorial control without deployment fragility", and every extra way
// to rearrange this page is another way a routine seasonal edit takes the
// site down. Fall to holiday to January to spring is four picks in the
// editor, not a redesign.
//
// Sections that depend on Tina render nothing when their content is
// empty, so an unconfigured homepage degrades to a shorter page rather
// than a broken one.

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default async function HomePage() {
  const content = await getHomepage();
  const { showPricing } = getCurrentCta();

  // Featured ideas are a separate Tina list from the seasonal cards, so
  // the founder can promote an evergreen idea without it displacing a
  // seasonal one. When both point at the same idea, showing it twice on
  // one page reads as a mistake rather than emphasis.
  const seasonalSlugs = new Set(
    content.seasonalCards.map((i) => i._sys.filename)
  );
  const extraIdeas = content.featuredGatheringIdeas.filter(
    (i) => !seasonalSlugs.has(i._sys.filename)
  );

  return (
    <>
      <SeasonalHero content={content} />
      <SeasonalCards ideas={[...content.seasonalCards, ...extraIdeas]} />
      <PromiseBand />
      <HowItWorks />
      <FeatureGrid />
      <HostReadySection />
      <FounderNote />
      <FeaturedArticles posts={content.featuredArticles} />
      <CommunityTeaser stories={content.featuredCommunityStories} />
      {/* Pricing on the homepage stays governed by the launch phase, as
          it was before. /pricing itself is always published — see the
          note in that page. */}
      {showPricing && <PricingSection />}
      <CtaSection />
    </>
  );
}
