import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import GuestListForm from "@/components/GuestListForm";
import { Band, Display } from "@/components/Display";
import { EditorialCard, FeatureLede } from "@/components/Cards";
import Icon, { type IconName } from "@/components/Icon";
import { BotanicalDivider } from "@/components/Botanical";
import { getAllPosts, articleImage } from "@/lib/tina-content";

export const metadata: Metadata = {
  title: "The Coordinated Host",
  description:
    "Thoughtful hosting, simplified. Practical guidance, real numbers and honest advice for hosts who care about connection — and the details.",
  alternates: { canonical: "/coordinated-host" },
  openGraph: { url: "/coordinated-host" },
};

const TOPICS: { icon: IconName; title: string; body: string; href: string }[] = [
  { icon: "envelope", title: "Invitations", body: "Design, send and track with ease — or bring the artwork you already have.", href: "/what-it-does" },
  { icon: "rsvp", title: "RSVPs", body: "Keep guests in the loop without chasing anyone through a group chat.", href: "/how-it-works" },
  { icon: "gift", title: "Who’s Bringing What", body: "Coordinate contributions without the chaos, the doubling-up or the guesswork.", href: "/what-it-does" },
  { icon: "book", title: "Guest Book", body: "Keep the people worth inviting again connected to your account-level Guest Book.", href: "/what-it-does" },
];

export default async function CoordinatedHostPage() {
  const posts = await getAllPosts();
  const [lead, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="Editorial"
        headline="The Coordinated Host."
        emphasisLine="Thoughtful hosting, simplified."
        emphasisSize="small"
        image="/images/ChatGPT Image Sep 1, 2026, 08_06_00 PM (7).png"
        imageAlt="A warm, editorial home-hosting table in natural evening light"
        imageCaption="Practical hosting guidance, grounded in the homes and gatherings people actually have."
        body={<p>Ideas, guidance and real-world tools for hosts who care about connection — and the details.</p>}
        action={<Link href="#the-journal" className="inline-flex items-center justify-center rounded-lg bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90">Explore the Journal</Link>}
      />

      {lead && (
        <div className="relative z-10 bg-offwhite px-3 sm:px-5">
          <div className="mx-auto -mt-10 max-w-editorial md:-mt-14">
            <FeatureLede
              href={`/coordinated-host/${lead._sys.filename}`}
              title={lead.title}
              deck={lead.deck}
              image={articleImage(lead)}
              imageAlt={lead.featuredImageAlt || lead.title}
              photoCaption={lead.featuredImageAlt || `${lead.title} — a real home, warm natural light`}
              meta={<p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">{[lead.category, lead.franchise].filter(Boolean).join(" · ")}</p>}
            />
          </div>
        </div>
      )}

      <Band tone="parchment">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <BotanicalDivider className="mb-6" />
          <Display className="text-center text-2xl leading-snug text-forest md:text-3xl">Hosting, made simple</Display>
          <p className="mx-auto mt-3 max-w-2xl text-center font-body text-base leading-relaxed text-forest/70">Practical guidance, real numbers, and tools that make every gathering feel less like a scramble.</p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {TOPICS.map((t, i) => (
              <li key={t.title} className={`lg:px-6 ${i > 0 ? "lg:border-l lg:border-sage/30" : ""}`}>
                <Icon name={t.icon} size={28} className="text-forest/70" />
                <h3 className="mt-4 font-body text-xs font-bold uppercase tracking-[0.18em] text-forest">{t.title}</h3>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{t.body}</p>
                <Link href={t.href} className="mt-3 inline-block font-body text-xs font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 transition-colors duration-400 hover:text-sage">Explore <span aria-hidden>&rarr;</span></Link>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      <Band tone="plain" id="the-journal">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <h2 className="flex items-center gap-4 font-body text-[0.7rem] font-bold uppercase tracking-[0.22em] text-forest/65"><span aria-hidden className="h-px w-8 flex-shrink-0 bg-gold" />Latest from the journal</h2>
          {rest.length === 0 ? (
            <p className="mt-6 font-body text-base text-forest/70">More pieces are on the way. The lead story is above.</p>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <li key={post._sys.filename}>
                  <EditorialCard
                    href={`/coordinated-host/${post._sys.filename}`}
                    kicker={post.franchise || post.category}
                    title={post.title}
                    deck={post.deck}
                    image={articleImage(post)}
                    imageAlt={post.featuredImageAlt || post.title}
                    photoCaption={post.featuredImageAlt || `${post.title} — a real home, warm natural light`}
                    priority={i < 2}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-12 md:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12">
            <div><Display className="text-2xl leading-snug text-forest md:text-[1.9rem]">Good hosting starts here.</Display><p className="mt-3 max-w-prose font-body text-base leading-relaxed text-forest/75">Ideas, hosting tips and seasonal inspiration — delivered to your inbox, and not very often.</p></div>
            <GuestListForm />
          </div>
        </div>
      </Band>

      <CtaBand headline="Read it here." emphasisLine="Then plan it in P&P." body="Every piece here ends somewhere practical. Start free on the web and put it to work on your next gathering." />
    </>
  );
}
