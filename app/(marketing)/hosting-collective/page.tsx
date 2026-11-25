import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TrackedLink from "@/components/hc-landing/TrackedLink";
import { EditorialCard } from "@/components/Cards";
import { APP_STORE_URL, PLAY_STORE_URL, STORE_BADGES } from "@/lib/app-links";
import { getPostBySlug, articleImage } from "@/lib/tina-content";
import {
  COMMUNITY_GROUP_URL,
  HC_APPLY_PATH,
  HC_FEATURED_ARTICLE_PATH,
  HC_FEATURED_ARTICLE_SLUG,
  getApplicationsOpen,
} from "@/lib/hc/community";

// HOSTING COLLECTIVE COMMUNITY LANDING.
// Copy is the founder's approved November 24 Community Launch Kit wording; it is not paraphrased. The page keeps the earlier approved
// creator-program language (no earnings claims, no promised compensation, no guarantee of approval, no commission rate) under the partner pathway.
// Not linked from navigation or the sitemap and marked noindex until the owner approves launch. QA only until separately approved.
// The hidden Hosting Partners Facebook group is never referenced here (see lib/hc/community.ts).
export const metadata: Metadata = {
  title: "The Hosting Collective & Community | Place & Plenty",
  description:
    "Join a free community for practical hosting ideas, discover the Place & Plenty app and explore Hosting Partner opportunities. Real homes. More gathering.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/hosting-collective" },
};

// Applications-open state is read server-side from one public boolean and refreshed every minute.
export const revalidate = 60;

const BUTTON =
  "inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-3 font-body font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
const PRIMARY = `${BUTTON} bg-forest text-parchment`;
const SECONDARY = `${BUTTON} border border-forest text-forest`;
const TEXT_LINK = "inline-flex min-h-[44px] items-center font-body font-semibold text-forest underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

const FAQ: [string, string][] = [
  ["Do I need the app to join the community?", "No. The Hosting Collective is a free Facebook community, and you do not need to download or buy anything to take part."],
  ["Who can find the community, and is it private?", "The group is private and publicly discoverable, so anyone can find it, but you need a Facebook account and group approval to join. Member posts are moderated."],
  ["Is joining the Facebook group the same as a Place & Plenty membership?", "No. Taking part in the free Facebook community is separate from any Place & Plenty website membership. Facebook membership never establishes Hosting Partner eligibility, activates commissions or changes our official membership records."],
  ["How does the Hosting Partner approval process work?", "Hosting Partners are approved by the founder through the official application on this website. Applying does not guarantee a place, and there is no cost to apply. Approval is not automatic."],
  ["Can I use the Place & Plenty app without Facebook?", "Yes. The app works independently of Facebook and of the community. Use either one, both, or neither."],
];

export default async function HostingCollectivePage() {
  const applicationsOpen = await getApplicationsOpen();
  const post = await getPostBySlug(HC_FEATURED_ARTICLE_SLUG).catch(() => null);

  return (
    <>
      {/* Hero */}
      <section className="bg-offwhite py-14 md:py-24">
        <div className="mx-auto max-w-editorial px-6">
          <p className="font-body text-sm font-semibold uppercase tracking-wide text-goldInk">PLACE &amp; PLENTY COMMUNITY</p>
          <h1 className="mt-3 max-w-prose font-display text-4xl leading-tight text-forest md:text-5xl">Good company for the way you gather.</h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Real homes. Helpful ideas. A place to ask, share and make hosting feel a little lighter.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TrackedLink href={COMMUNITY_GROUP_URL} external event="community_join_click" meta={{ entry_point: "hero" }} className={PRIMARY}>Join the Community</TrackedLink>
            <a href="#app" className={SECONDARY}>Download the App</a>
            <a href="#partners" className={SECONDARY}>Explore Hosting Partner Opportunities</a>
          </div>
          <p className="mt-4 font-body text-sm text-forest/70">Free Facebook community. No app download required.</p>
        </div>
      </section>

      {/* Three independent pathways: stacked Community, App, Partners on mobile */}
      <section className="bg-parchment py-14 md:py-16" aria-labelledby="pathways-heading">
        <div className="mx-auto max-w-editorial px-6">
          <h2 id="pathways-heading" className="sr-only">Three ways to take part</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <article id="community" className="flex flex-col rounded-card border border-sage/30 bg-offwhite p-6">
              <h3 className="font-display text-xl text-forest">Join The Hosting Collective</h3>
              <p className="mt-2 font-body leading-relaxed text-forest/80">
                Free community participation: questions, advice, budgeting, menus, decorating and traditions.
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">A Facebook account and group approval are required.</p>
              <div className="mt-auto pt-5">
                <TrackedLink href={COMMUNITY_GROUP_URL} external event="community_join_click" meta={{ entry_point: "pathway" }} className={PRIMARY}>Join the Community</TrackedLink>
              </div>
            </article>

            <article id="app" className="flex scroll-mt-6 flex-col rounded-card border border-sage/30 bg-offwhite p-6">
              <h3 className="font-display text-xl text-forest">Bring the planning together</h3>
              <p className="mt-2 font-body leading-relaxed text-forest/80">
                Place &amp; Plenty helps a host get ready so they can enjoy their own gathering: guests and RSVPs, the menu and the shopping, in one place.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 font-body text-forest/80">
                <li>Keep guests in the loop without chasing anyone through a group chat.</li>
                <li>Plan the menu and the shopping together.</li>
                <li>Coordinate who is bringing what.</li>
              </ul>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                {APP_STORE_URL && (
                  <TrackedLink href={APP_STORE_URL} external event="app_store_click" meta={{ store: "apple", entry_point: "landing" }} className="inline-flex min-h-[44px] items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    {STORE_BADGES.apple ? (
                      <Image src={STORE_BADGES.apple} alt="Download on the App Store" width={120} height={40} className="h-11 w-auto" />
                    ) : (
                      <span className={SECONDARY}>Download on the App Store</span>
                    )}
                  </TrackedLink>
                )}
                {PLAY_STORE_URL && (
                  <TrackedLink href={PLAY_STORE_URL} external event="app_store_click" meta={{ store: "google", entry_point: "landing" }} className="inline-flex min-h-[44px] items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
                    {STORE_BADGES.google ? (
                      <Image src={STORE_BADGES.google} alt="Get it on Google Play" width={135} height={40} unoptimized className="h-11 w-auto" />
                    ) : (
                      <span className={SECONDARY}>Get it on Google Play</span>
                    )}
                  </TrackedLink>
                )}
              </div>
              <p className="mt-3 font-body text-xs text-forest/70">Free to download. Optional in-app purchases are available.</p>
            </article>

            <article id="partners" className="flex scroll-mt-6 flex-col rounded-card border border-sage/30 bg-offwhite p-6">
              <h3 className="font-display text-xl text-forest">Explore Hosting Partner opportunities</h3>
              <p className="mt-2 font-body leading-relaxed text-forest/80">
                Hosting Partners are creators who share honest, prepared-not-perfect hosting. Apply through our official application and the founder reads every one.
                Approval is not automatic and not guaranteed.
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
                If approved, you receive a creator guide, our brand kit and a personal referral link. We do not pay for content unless a separate written agreement says so.
              </p>
              <div className="mt-auto pt-5">
                {applicationsOpen ? (
                  <TrackedLink href={HC_APPLY_PATH} event="partner_application_click" meta={{ entry_point: "pathway" }} className={PRIMARY}>Apply to be considered</TrackedLink>
                ) : (
                  <p role="status" className="font-body text-sm text-forest/80">Hosting Partner applications are not open right now. Please check back soon.</p>
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Editorial integration */}
      {post && (
        <section className="bg-offwhite py-14 md:py-16" aria-labelledby="idea-heading">
          <div className="mx-auto max-w-editorial px-6">
            <h2 id="idea-heading" className="font-display text-2xl text-forest md:text-3xl">A useful idea for your next gathering</h2>
            <div className="mt-6 max-w-md">
              <EditorialCard
                href={HC_FEATURED_ARTICLE_PATH}
                kicker={post.franchise || post.category}
                title={post.title}
                deck={post.deck}
                image={articleImage(post)}
                imageAlt={post.featuredImageAlt ?? undefined}
              />
            </div>
            <p className="mt-4">
              <Link href="/coordinated-host" className={TEXT_LINK}>More from The Coordinated Host</Link>
            </p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="bg-parchment py-14 md:py-16" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-prose px-6">
          <h2 id="faq-heading" className="font-display text-2xl text-forest md:text-3xl">Questions</h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt className="font-body font-semibold text-forest">{q}</dt>
                <dd className="mt-1 font-body leading-relaxed text-forest/80">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing */}
      <section className="bg-offwhite py-14 md:py-20">
        <div className="mx-auto max-w-editorial px-6 text-center">
          <h2 className="font-display text-3xl text-forest md:text-4xl">There is room for your kind of gathering.</h2>
          <p className="mx-auto mt-4 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            Start with an idea, ask a question or bring the planning together. Choose the path that helps you today.
          </p>
          <div className="mt-8">
            <TrackedLink href={COMMUNITY_GROUP_URL} external event="community_join_click" meta={{ entry_point: "closing" }} className={PRIMARY}>Join the Community</TrackedLink>
          </div>
          <p className="mt-8 font-body text-sm text-forest/70">Place &amp; Plenty is owned and operated by AR Squared Inc.</p>
          <nav aria-label="Legal and support" className="mt-1 flex flex-wrap justify-center gap-x-6">
            <Link href="/terms" className={TEXT_LINK}>Terms</Link>
            <Link href="/privacy" className={TEXT_LINK}>Privacy</Link>
            <Link href="/support" className={TEXT_LINK}>Support</Link>
          </nav>
        </div>
      </section>
    </>
  );
}
