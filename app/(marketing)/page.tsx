import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import DifferenceBand from "@/components/DifferenceBand";
import ConnectedBand from "@/components/ConnectedBand";
import HostingRealitySection from "@/components/HostingRealitySection";
import FeaturedArticles from "@/components/FeaturedArticles";
import CommunityTeaser from "@/components/CommunityTeaser";
import FounderNote from "@/components/FounderNote";
import PricingSection from "@/components/PricingSection";
import CtaSection from "@/components/CtaSection";
import { getHomepage } from "@/lib/tina-content";
import { getCurrentCta } from "@/lib/launch-state";
import { OrganizationSchema } from "@/components/StructuredData";

// THE HOMEPAGE, composed to the approved home page reference.
//
// The reference's order, and what each band is for:
//
//   SeasonalHero        brand line, photographic, full-bleed
//   SeasonalCards       "Reasons people are hosting right now" + 4 cards
//   HostingRealitySection  the turn — okay, now what?
//   DifferenceBand      the positioning: invitations, RSVPs, the loop
//   ConnectedBand       web and app, one account, one record
//   FeaturedArticles    editorial rail
//   CommunityTeaser     Show Us How You Gather
//   FounderNote         Hi, I'm Alexis
//   PricingSection      launch-gated
//   CtaSection          conversion
//
// EVERY BAND EXCEPT THE HERO IS INSET (see Band in components/Display).
// Sections sit as panels on the cream page ground with a margin and soft
// corners, which is the reference's most distinctive structural move and
// the thing that separates editorial composition from a stack of
// full-width stripes. The hero is full-bleed because a photograph that
// stops short of the edge stops being an establishing shot.
//
// PRODUCT TRUTH OVERRIDES THE REFERENCE WHERE THEY DISAGREE. The
// reference's feature grid says "My Shopping List" (§9/§32: My
// Shopping), its Space Mode copy describes the guest experience rather
// than Space Mode, and its footer links to Careers, Press and a Help
// Center that do not exist. Composition, weight, photography, botanicals
// and pacing come from the reference; names and claims come from the
// reconciliation document.
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
  const content = await getHomepage();
  const { showPricing } = getCurrentCta();

  // Featured ideas are a separate Tina list from the seasonal cards, so
  // an evergreen idea can be promoted without displacing a seasonal one.
  // Showing the same idea twice reads as a mistake rather than emphasis.
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
      <SeasonalCards
        ideas={[...content.seasonalCards, ...extraIdeas]}
        reasonLine={content.reasonLine}
      />

      <HostingRealitySection compact />
      <DifferenceBand />
      <ConnectedBand />

      <FeaturedArticles posts={content.featuredArticles} />
      <CommunityTeaser stories={content.featuredCommunityStories} />
      <FounderNote />

      {showPricing && <PricingSection />}
      <CtaSection />
    </>
  );
}
