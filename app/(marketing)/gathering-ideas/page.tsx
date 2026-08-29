import type { Metadata } from "next";
import Eyebrow from "@/components/Eyebrow";
import GatheringIdeaCard from "@/components/GatheringIdeaCard";
import CtaSection from "@/components/CtaSection";
import { getAllGatheringIdeas } from "@/lib/tina-content";

// GATHERING IDEAS — the primary content destination (§14).
//
// It answers "what should we gather for, and what could this gathering
// look like?" — which is a different question from The Coordinated Host's
// "how do I host this better?". Keeping the two apart is what stops both
// from collapsing into a generic blog.
//
// Grouped by season rather than listed by date. A visitor arriving in
// October wants what is happening now, and a reverse-chronological feed
// buries a perfect fall idea published last year under a spring one
// posted last week. Evergreen ideas ("Any") come last, since they are
// always true and never urgent.

export const metadata: Metadata = {
  title: "Gathering Ideas",
  description:
    "Reasons to have people over, and what each one could look like. Seasonal and evergreen ideas for real homes.",
  alternates: { canonical: "/gathering-ideas" },
  openGraph: {
    title: "Gathering Ideas | Place & Plenty",
    description:
      "Reasons to have people over, and what each one could look like.",
    url: "/gathering-ideas",
  },
};

const SEASON_ORDER = ["Fall", "Winter", "Spring", "Summer", "Any"];

export default async function GatheringIdeasPage() {
  const ideas = await getAllGatheringIdeas();

  const groups = SEASON_ORDER.map((season) => ({
    season,
    // An idea with no season set is treated as evergreen rather than
    // dropped — losing published work to a blank field would be worse
    // than filing it slightly wrong.
    ideas: ideas.filter((i) => (i.season || "Any") === season),
  })).filter((g) => g.ideas.length > 0);

  return (
    <>
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>Gathering Ideas</Eyebrow>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-forest md:text-5xl">
            Reasons to have people over.
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Not perfect parties. Actual gatherings — game day, a backyard
            dinner before it gets cold, a birthday on a Tuesday — and what
            each one could look like at your place.
          </p>
        </div>
      </section>

      <section className="bg-offwhite py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          {groups.length === 0 ? (
            <div className="rounded-card border border-sage/30 bg-cream p-8">
              <p className="font-display text-xl text-forest">
                Ideas rotate with the season.
              </p>
              <p className="mt-2 max-w-prose font-body text-base leading-relaxed text-forest/75">
                Game day, backyard dinners, Halloween, Friendsgiving — and
                whatever the calendar turns up next. Join the Guest List
                below and they&rsquo;ll come to you.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.season} className="mb-14 last:mb-0">
                <h2 className="font-display text-2xl text-forest">
                  {group.season === "Any" ? "Any time of year" : group.season}
                </h2>
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {group.ideas.map((idea, i) => (
                    <GatheringIdeaCard
                      key={idea._sys.filename}
                      idea={idea}
                      priority={i < 2 && group.season === groups[0].season}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <CtaSection />
    </>
  );
}
