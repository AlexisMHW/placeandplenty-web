import Link from "next/link";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import Icon, { type IconName } from "@/components/Icon";
import { Band, Display, Ornament } from "@/components/Display";
import { BreadcrumbSchema, FaqSchema } from "@/components/StructuredData";

export type SearchLandingFeature = {
  icon: IconName;
  title: string;
  body: string;
};

export type SearchLandingStep = {
  title: string;
  body: string;
};

export type SearchLandingLink = {
  href: string;
  label: string;
  description: string;
};

export type SearchLandingFaq = { q: string; a: string };

export default function SearchLandingPage({
  path,
  eyebrow,
  headline,
  emphasisLine,
  intro,
  heroImage,
  heroImageAlt,
  distinction,
  distinctionBody,
  steps,
  features,
  proofHeading,
  proofBody,
  faqs,
  related,
}: {
  path: string;
  eyebrow: string;
  headline: string;
  emphasisLine: string;
  intro: string;
  heroImage: string;
  heroImageAlt: string;
  distinction: string;
  distinctionBody: string;
  steps: SearchLandingStep[];
  features: SearchLandingFeature[];
  proofHeading: string;
  proofBody: string;
  faqs: SearchLandingFaq[];
  related: SearchLandingLink[];
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", url: "https://placeandplenty.com" },
          { name: eyebrow, url: `https://placeandplenty.com${path}` },
        ]}
      />
      <FaqSchema faqs={faqs} />

      <PageHero
        eyebrow={eyebrow}
        headline={headline}
        emphasisLine={emphasisLine}
        image={heroImage}
        imageAlt={heroImageAlt}
        body={<p>{intro}</p>}
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-forest px-6 py-3.5 font-body text-sm font-semibold text-offwhite transition-colors duration-300 hover:bg-forest/90"
            >
              Start planning free
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-forest/30 px-6 py-3.5 font-body text-sm font-semibold text-forest transition-colors duration-300 hover:bg-forest/5"
            >
              See how it works
            </Link>
          </div>
        }
      />

      <Band tone="forest">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center md:py-16">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-gold">
            The Place &amp; Plenty difference
          </p>
          <Display className="mt-4 text-3xl leading-tight text-offwhite md:text-[2.5rem]">
            {distinction}
          </Display>
          <Ornament tone="dark" align="center" className="mt-6" />
          <p className="mx-auto mt-6 max-w-2xl font-body text-base leading-relaxed text-offwhite/80 md:text-lg">
            {distinctionBody}
          </p>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">
            From idea to doorbell
          </p>
          <Display className="mt-4 max-w-3xl text-3xl leading-tight text-forest md:text-[2.55rem]">
            One gathering. One connected plan.
          </Display>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-card border border-sage/25 bg-offwhite p-6 shadow-softer">
                <p className="font-display text-2xl text-goldInk">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-4 font-display text-xl leading-snug text-forest">{step.title}</h2>
                <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto max-w-editorial px-6 py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">Built for real hosting</p>
            <Display className="mt-4 text-3xl leading-tight text-forest md:text-[2.55rem]">The details stop living in five different places.</Display>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.title} className="border-t border-sage/30 pt-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream text-forest">
                  <Icon name={feature.icon} size={22} />
                </span>
                <h2 className="mt-4 font-display text-xl text-forest">{feature.title}</h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/75">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="sage">
        <div className="mx-auto grid max-w-editorial gap-8 px-6 py-14 md:py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Display className="text-3xl leading-tight text-forest md:text-[2.35rem]">{proofHeading}</Display>
          <div>
            <p className="font-body text-base leading-relaxed text-forest/80 md:text-lg">{proofBody}</p>
            <p className="mt-5 border-l-2 border-gold pl-5 font-display text-xl italic leading-relaxed text-forest">
              The preparation serves the people. The people are the point.
            </p>
          </div>
        </div>
      </Band>

      <Band tone="cream">
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-20">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">Questions, answered</p>
          <Display className="mt-4 text-3xl text-forest md:text-[2.45rem]">What hosts usually want to know.</Display>
          <div className="mt-9 divide-y divide-sage/25 border-y border-sage/25">
            {faqs.map((faq) => (
              <section key={faq.q} className="py-6">
                <h2 className="font-display text-xl text-forest">{faq.q}</h2>
                <p className="mt-3 font-body text-base leading-relaxed text-forest/75">{faq.a}</p>
              </section>
            ))}
          </div>
        </div>
      </Band>

      <Band tone="plain">
        <div className="mx-auto max-w-editorial px-6 py-14 md:py-16">
          <p className="font-body text-[0.7rem] font-bold uppercase tracking-[0.24em] text-forest/70">Keep planning</p>
          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {related.map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-card border border-sage/25 bg-offwhite p-6 shadow-softer transition-transform duration-300 hover:-translate-y-1">
                <h2 className="font-display text-xl text-forest group-hover:text-goldInk">{item.label}</h2>
                <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">{item.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 font-body text-sm font-semibold text-forest">
                  Explore <Icon name="arrow" size={16} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Band>

      <CtaBand
        headline="Less scrambling."
        emphasisLine="More gathering."
        body="Start with the gathering in front of you. Place & Plenty will help you carry the people, food, shopping, space and timing in one connected plan."
      />
    </>
  );
}
