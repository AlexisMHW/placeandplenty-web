import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import Photo from "@/components/Photo";
import { Band, Display } from "@/components/Display";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalSprig } from "@/components/Botanical";
import { getAllCommunityStories } from "@/lib/tina-content";

export const metadata: Metadata = {
  title: "Show Us How You Gather",
  description:
    "Real hosts. Real gatherings. Real inspiration. Share how you bring people together — apartments, backyards, birthdays and everything in between.",
  alternates: { canonical: "/show-us-how-you-gather" },
  openGraph: { url: "/show-us-how-you-gather" },
};

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "camera",
    title: "Snap a few photos",
    body: "The moments, the details, and the vibe. Phone photos are exactly right.",
  },
  {
    icon: "heart",
    title: "Share your story",
    body: "Tell us about your gathering — what you planned, what you loved, and what you learned.",
  },
  {
    icon: "sparkle",
    title: "Inspire others",
    body: "Your ideas might be just what another host is looking for this weekend.",
  },
];

const COUNTS = [
  "A birthday on a Tuesday",
  "Paper plates and a folding table",
  "Grandma’s china, finally used",
  "Six people in a one-bedroom",
  "The backyard, before it gets cold",
  "Mismatched chairs from three rooms",
];

export default async function ShowUsPage() {
  const stories = await getAllCommunityStories();

  return (
    <>
      <PageHero
        eyebrow="Show Us How You Gather"
        headline="Real hosts. Real gatherings."
        emphasisLine="Real inspiration."
        image="/images/show_us_how_you_gather-hero.png"
        imageAlt="Friends gathered around a warm, lived-in home table"
        imageCaption="The point is not a perfect party. It is how people really gather."
        stamp={{ top: "Our community", bottom: "Our inspiration", tone: "dark" }}
        body={
          <p>
            From cozy nights in to once-in-a-lifetime celebrations — see how
            our community brings people together, in the homes they actually
            have.
          </p>
        }
        action={
          <Link
            href="#share"
            className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
          >
            Share Your Gathering
          </Link>
        }
      />

      <Band tone="parchment" id="share">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <Display
            emphasis="someone needs"
            className="text-center text-3xl leading-tight text-forest md:text-[2.3rem]"
          >
            Your gathering could be the inspiration someone needs.
          </Display>

          <div className="mt-12 grid gap-8 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={`flex gap-4 lg:px-4 ${
                  i > 0 ? "lg:border-l lg:border-sage/30" : ""
                }`}
              >
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest">
                  <Icon name={s.icon} size={22} />
                </span>
                <div>
                  <h2 className="font-display text-base text-forest">
                    {i + 1}. {s.title}
                  </h2>
                  <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-sage/30 bg-cream p-6">
              <p className="font-body text-sm leading-relaxed text-forest/80">
                It only takes a few minutes, but the inspiration lasts a long
                time.
              </p>
              <a
                href="mailto:support@placeandplenty.com?subject=Show%20Us%20How%20You%20Gather"
                className="mt-4 block w-full rounded-lg bg-forest px-5 py-3 text-center font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
              >
                Share Your Gathering
              </a>
              <p className="mt-3 font-body text-xs leading-relaxed text-forest/60">
                Send photos and a few lines to{" "}
                <span className="font-semibold">support@placeandplenty.com</span>
                . We&rsquo;ll reply about permission before anything appears.
              </p>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <h2 className="flex items-center gap-4 font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/65">
            <span aria-hidden className="h-px w-8 flex-shrink-0 bg-gold" />
            The community gallery
          </h2>

          {stories.length > 0 ? (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {stories.map((story, i) => (
                <li key={story._sys.filename}>
                  <Link
                    href={`/show-us-how-you-gather/${story._sys.filename}`}
                    className="group block overflow-hidden rounded-2xl border border-sage/25 shadow-softer transition-shadow duration-400 hover:shadow-soft"
                  >
                    <div className="relative">
                      <Photo
                        src={story.heroImage}
                        alt={story.heroImageAlt}
                        caption={story.title}
                        tone="forest"
                        className="aspect-[4/5] w-full"
                        imageClassName="transition-transform duration-400 group-hover:scale-[1.03]"
                        sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw"
                        priority={i < 2}
                      />
                      <div className="absolute bottom-3 left-3 rounded-lg bg-offwhite/95 px-3 py-2">
                        <p className="font-display text-sm leading-tight text-forest">
                          {story.title}
                        </p>
                        {story.gatheringType && (
                          <p className="mt-0.5 font-body text-[0.62rem] uppercase tracking-[0.14em] text-forest/60">
                            {story.gatheringType}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 rounded-2xl border border-sage/30 bg-cream px-6 py-14 text-center">
              <BotanicalSprig className="mx-auto text-olive" size={56} />
              <p className="mx-auto mt-5 max-w-lg font-display text-2xl leading-snug text-forest">
                This is where your gatherings will be.
              </p>
              <p className="mx-auto mt-3 max-w-xl font-body text-base leading-relaxed text-forest/75">
                Every gathering here is a real one, shared by the person who
                hosted it and published only with their permission. That is
                the whole point of the page, so the ones you see will always
                be real — starting with yours.
              </p>
              <a
                href="mailto:support@placeandplenty.com?subject=Show%20Us%20How%20You%20Gather"
                className="mt-7 inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
              >
                Share your gathering
              </a>
            </div>
          )}
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <Display
            emphasis="counts too"
            className="text-2xl leading-snug text-forest md:text-[2rem]"
          >
            Your gathering counts too.
          </Display>
          <p className="mt-4 max-w-2xl font-body text-base leading-relaxed text-forest/75">
            This is not a perfect-party competition. It is the actual range of
            how people have people over — and the ordinary end of it is the
            part most worth seeing.
          </p>

          <ul className="mt-8 flex flex-wrap gap-3">
            {COUNTS.map((c) => (
              <li
                key={c}
                className="rounded-full border border-sage/40 bg-offwhite px-4 py-2 font-body text-sm text-forest/80"
              >
                {c}
              </li>
            ))}
          </ul>

          <div className="mt-10 max-w-2xl border-l-2 border-gold pl-5">
            <h3 className="font-display text-lg text-forest">
              About permission
            </h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-forest/75">
              Nothing is published without explicit consent — for the photos,
              for anyone identifiable in them, for children, for your home, and
              for anything you are quoted saying. We will always confirm before
              a story appears, and you can ask us to take it down at any time.
            </p>
          </div>
        </div>
      </Band>

      <CtaBand
        headline="Host it."
        emphasisLine="Then show us."
        body="Plan your next gathering free on the web, and tell us how it went."
      />
    </>
  );
}
