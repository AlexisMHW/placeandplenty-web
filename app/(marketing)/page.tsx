import type { Metadata } from "next";
import SeasonalHero from "@/components/SeasonalHero";
import SeasonalCards from "@/components/SeasonalCards";
import DifferenceBand from "@/components/DifferenceBand";
import FeaturedArticles from "@/components/FeaturedArticles";
import CommunityTeaser from "@/components/CommunityTeaser";
import FounderBand from "@/components/FounderBand";
import { getHomepage, getAllPosts, getAllGatheringIdeas } from "@/lib/tina-content";
import { OrganizationSchema } from "@/components/StructuredData";

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

  const seasonalSlugs = new Set(
    content.seasonalCards.map((i) => i._sys.filename)
  );
  const extraIdeas = content.featuredGatheringIdeas.filter(
    (i) => !seasonalSlugs.has(i._sys.filename)
  );

  const railPosts =
    content.featuredArticles.length >= 4
      ? content.featuredArticles.slice(0, 4)
      : allPosts.slice(0, 4);

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

      <CommunityTeaser stories={content.featuredCommunityStories} />

      <FounderBand
        eyebrow="Founder & host"
        headline="Hi, I’m Alexis. I built Place & Plenty for hosts like you."
        body="I’ve always believed the best memories happen around the table. But hosting? It can be a lot. Place & Plenty is the tool I wished I had — to plan with confidence, stay organised, and be present with my people."
        linkLabel="Read my story"
        tone="cream"
      />

      <FeaturedArticles posts={railPosts} />
    </>
  );
}
