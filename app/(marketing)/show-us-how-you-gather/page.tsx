import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Eyebrow from "@/components/Eyebrow";
import CtaSection from "@/components/CtaSection";
import { getAllCommunityStories } from "@/lib/tina-content";

// SHOW US HOW YOU GATHER — §16.
//
// The governing emotional rule is "Your gathering counts too", and the
// section is explicitly NOT a perfect-party showcase. The copy names
// paper plates, mismatched chairs and apartments on purpose; if it ever
// starts reading like a styling gallery, that is the thing to fix.
//
// CONSENT IS THE LOAD-BEARING PART. §16: submission is not blanket
// marketing consent, and permission has to cover identifiable adults,
// children, private homes, submitted photos, and stories or quotes. Two
// things follow, and neither is decorative:
//
//   1. Nothing renders here without `consentConfirmed` — enforced in
//      lib/tina-content.ts, so it cannot be forgotten at a call site.
//   2. The submission copy below SAYS what is being asked for, in plain
//      words, before anyone sends anything. A permission checkbox that
//      is only explained in a privacy policy is not informed consent.
//
// Submissions arrive by email today. That is deliberate: a form that
// accepts photographs of people's homes and children needs storage,
// retention and deletion decided first, and none of that is built. Email
// is honest about where the photos are going.

export const metadata: Metadata = {
  title: "Show Us How You Gather",
  description:
    "Real homes, real tables, real people. Share how you gather — backyards, apartments, paper plates and Grandma's china.",
  alternates: { canonical: "/show-us-how-you-gather" },
  openGraph: {
    title: "Show Us How You Gather | Place & Plenty",
    description: "Real homes, real tables, real people. Your gathering counts too.",
    url: "/show-us-how-you-gather",
  },
};

// support@ is the only verified Place & Plenty address (it is what the
// app's Settings, /support and /delete-account all use). A separate
// hello@ or community@ would look tidier and might not exist, so
// submissions ride on the address that is known to be monitored, with a
// subject line that sorts them.
const SUBMIT_EMAIL = "support@placeandplenty.com";

export default async function ShowUsPage() {
  const stories = await getAllCommunityStories();

  return (
    <>
      <section className="bg-parchment py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          <Eyebrow>Show Us How You Gather</Eyebrow>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-forest md:text-5xl">
            Your gathering counts too.
          </h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Not the perfect party. The real one — the backyard, the
            apartment, the folding chair from the garage, the football
            spread, the birthday nobody planned until Thursday. Paper plates
            and Grandma&rsquo;s china both count.
          </p>
        </div>
      </section>

      <section className="bg-offwhite py-16 md:py-20">
        <div className="mx-auto max-w-editorial px-6">
          {stories.length === 0 ? (
            <div className="rounded-card border border-sage/30 bg-cream p-8">
              <p className="font-display text-xl text-forest">
                This is where your gatherings go.
              </p>
              <p className="mt-2 max-w-prose font-body text-base leading-relaxed text-forest/75">
                Send us the one you actually had — the backyard, the
                folding chair, the football spread. Everything below
                explains exactly what we&rsquo;d ask permission for before
                anything is published.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => (
                <li key={story._sys.filename}>
                  <Link
                    href={`/show-us-how-you-gather/${story._sys.filename}`}
                    className="group block h-full overflow-hidden rounded-card border border-sage/30 bg-offwhite shadow-softer transition-shadow duration-400 hover:shadow-soft"
                  >
                    {story.heroImage && (
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                          src={story.heroImage}
                          alt={story.heroImageAlt || ""}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-400 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      {story.gatheringType && (
                        <p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/75">
                          {story.gatheringType}
                        </p>
                      )}
                      <h2 className="mt-2 font-display text-xl leading-snug text-forest">
                        {story.title}
                      </h2>
                      {story.contributorName && (
                        <p className="mt-2 font-body text-sm text-forest/60">
                          from {story.contributorName}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-cream py-16 md:py-20">
        <div className="mx-auto max-w-prose px-6">
          <h2 className="font-display text-2xl text-forest md:text-3xl">
            Share yours
          </h2>
          <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
            Email us at{" "}
            <a
              href={`mailto:${SUBMIT_EMAIL}?subject=Show%20Us%20How%20You%20Gather`}
              className="underline decoration-gold underline-offset-4 hover:text-forest"
            >
              {SUBMIT_EMAIL}
            </a>{" "}
            and tell us:
          </p>

          <ul className="mt-5 space-y-2 pl-5 font-body text-base leading-relaxed text-forest/80 [&>li]:list-disc [&>li]:marker:text-gold">
            <li>What kind of gathering it was</li>
            <li>A few photos</li>
            <li>A short story or caption — a couple of sentences is plenty</li>
            <li>What worked</li>
            <li>What you&rsquo;d do differently</li>
            <li>
              If you used Place &amp; Plenty, what it helped with (optional)
            </li>
          </ul>

          <div className="mt-8 rounded-card border border-gold bg-offwhite p-6">
            <p className="font-body text-xs font-bold uppercase tracking-wide text-forest/70">
              Before you send photos
            </p>
            <p className="mt-2 font-body text-base leading-relaxed text-forest/80">
              Sending something is not the same as agreeing to have it
              published, so we ask separately and we ask plainly.
            </p>
            <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
              If we&rsquo;d like to feature your gathering, we&rsquo;ll write
              back and ask for permission covering{" "}
              <strong className="font-semibold text-forest">
                the photos themselves, anyone recognisable in them, any
                children, your home, and your words
              </strong>
              . Nothing goes on the website, Instagram, Pinterest or anywhere
              else until you say yes to that.
            </p>
            <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
              You can ask us to use a first name only, or no name at all. You
              can change your mind later and we&rsquo;ll take it down.
            </p>
            <p className="mt-3 font-body text-sm leading-relaxed text-forest/70">
              Please only send photos you took, or have the photographer&rsquo;s
              permission to share — and please ask the other adults in them
              first.
            </p>
          </div>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
