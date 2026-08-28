import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import PromiseBand from "@/components/PromiseBand";
import HostingRealitySection from "@/components/HostingRealitySection";
import GuestManagementSection from "@/components/GuestManagementSection";
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
import { OrganizationSchema } from "@/components/StructuredData";

// THE HOMEPAGE. The section order below IS the argument, and it follows
// §5's approved journey rather than being a stack of components:
//
//   I want to gather        -> SeasonalHero, SeasonalCards
//   people are coming       -> PromiseBand
//   hosting takes work      -> HostingRealitySection
//   P&P gets it             -> GuestManagementSection  <- the positioning
//   this would help me      -> HowItWorks, FeatureGrid, HostReadySection
//   others host like me     -> CommunityTeaser
//   a real person built it  -> FounderNote
//   I want to try it        -> PricingSection (launch-gated), CtaSection
//
// §5 warns explicitly against defaulting to "hero -> feature grid ->
// another feature grid -> CTA". The two beats that stop that from
// happening are HostingRealitySection (beat 5, the turn) and
// GuestManagementSection (beat 7, the differentiation) — everything
// after them reads as an answer rather than as a catalogue.
//
// GuestManagementSection sits BEFORE the feature grid deliberately. §3
// calls guest management "a core positioning advantage", and §32 forbids
// burying Invitations / RSVPs / Who's Bringing What / My Guest Book. Put
// after the grid it becomes one more section; put before it, it frames
// the grid.
//
// §13/§6 — SEASONAL CONTENT IS CONTENT, NOT CODE. The hero words and
// photograph, the four seasonal cards, the featured articles and the
// featured community stories all come from Tina, so a fall-to-holiday
// rotation is picks in the editor. The section ORDER stays here, because
// §6 says structure, layout and order remain in code and there is no
// page builder.
//
// Sections fed by Tina render nothing when empty, so an unconfigured
// homepage degrades to a shorter page rather than a broken one.

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
      <OrganizationSchema />

      {/* 1-4: reasons people are hosting right now */}
      <SeasonalHero content={content} />
      <SeasonalCards ideas={[...content.seasonalCards, ...extraIdeas]} />
      <PromiseBand />

      {/* 5: the turn — okay, people are coming, now what? */}
      <HostingRealitySection />

      {/* 7: the differentiation, before the product catalogue */}
      <GuestManagementSection />

      {/* 6 + 8: the product, introduced as the answer */}
      <HowItWorks />
      <FeatureGrid />
      <HostReadySection />

      {/* 9-12: editorial, community, founder */}
      <FeaturedArticles posts={content.featuredArticles} />
      <CommunityTeaser stories={content.featuredCommunityStories} />
      <FounderNote />

      {/* 13: conversion. Pricing on the homepage stays governed by the
          launch phase; /pricing itself is always published. */}
      {showPricing && <PricingSection />}
      <CtaSection />
    </>
  );
}
