import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import CtaBand from "@/components/CtaBand";
import { BreadcrumbSchema, FaqSchema } from "@/components/StructuredData";
import { COMPARISONS } from "@/lib/comparisons";
import { PRICING_TIERS, FREE_LIMITS_NOTE, PURCHASE_AVAILABILITY_NOTE } from "@/lib/pricing";

export const dynamicParams = false;
export function generateStaticParams() { return COMPARISONS.map(({ slug }) => ({ competitor: slug })); }
export function generateMetadata({ params }: { params: { competitor: string } }): Metadata {
  const item = COMPARISONS.find(c => c.slug === params.competitor);
  if (!item) return {};
  const path = `/compare/${item.slug}`;
  return { title: item.title, description: item.description, alternates: { canonical: path }, openGraph: { title: item.title, description: item.description, url: path, type: "website", images: [{ url: "/images/hero-tabletop.jpg", alt: "A table ready for a home gathering" }] }, twitter: { card: "summary_large_image", title: item.title, description: item.description, images: ["/images/hero-tabletop.jpg"] } };
}

export default function ComparisonPage({ params }: { params: { competitor: string } }) {
  const item = COMPARISONS.find(c => c.slug === params.competitor);
  if (!item) notFound();
  const faqs = [...item.faqs, { q: "Can I use P&P with an invitation I made elsewhere?", a: "P&P supports bringing your own invitation artwork. This does not automatically import another service’s guest list or RSVPs; keep one clear RSVP destination for guests." }, { q: "Can I start on the website for free?", a: `${FREE_LIMITS_NOTE} You can start in your browser. Premium features have separate access requirements; see pricing for current availability.` }];
  return <>
    <BreadcrumbSchema items={[{ name: "Home", url: "https://placeandplenty.com" }, { name: "Compare", url: "https://placeandplenty.com/compare" }, { name: `P&P vs. ${item.name}`, url: `https://placeandplenty.com/compare/${item.slug}` }]} />
    <FaqSchema faqs={faqs} />
    <PageHero eyebrow="Find your hosting fit" headline={`Place & Plenty vs. ${item.name}`} emphasisLine="Start with the gathering." body={<p>{item.intro}</p>} image="/images/hero-tabletop.jpg" imageAlt="A welcoming table prepared for a gathering at home" action={<Link href="/signup" className="inline-flex rounded-full bg-forest px-6 py-3 font-semibold text-offwhite">Start Hosting Free</Link>} />
    <div className="mx-auto max-w-editorial px-6 py-12 md:py-16">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-forest/75"><Link href="/compare" className="underline underline-offset-4">Compare hosting tools</Link><span> / P&amp;P vs. {item.name}</span></nav>
      <section className="grid gap-8 md:grid-cols-2" aria-label="Which tool fits your gathering?">
        <div className="rounded-card border border-sage/40 bg-offwhite p-7"><h2 className="font-display text-3xl text-forest">Where {item.name} fits</h2><p className="mt-4 leading-relaxed">{item.strength}</p><p className="mt-4 leading-relaxed">{item.fit}</p><a href={item.source} className="mt-4 inline-block text-sm underline underline-offset-4">Source: {item.sourceLabel}</a></div>
        <div className="rounded-card border border-gold bg-cream p-7"><h2 className="font-display text-3xl text-forest">Where P&amp;P fits</h2><p className="mt-4 leading-relaxed">Choose P&amp;P when you want a home for the preparation as well as the invitation. My Table, My Shopping List, My Hosting Closet and your timeline help organize the work before people arrive.</p><p className="mt-4 leading-relaxed">HostReady adds a readiness score with paid access. The point is to help you see what still needs attention while there is time to do something about it.</p><Link href="/what-it-does" className="mt-4 inline-block text-sm underline underline-offset-4">Explore P&amp;P’s features</Link></div>
      </section>
      <section className="mt-12"><h2 className="font-display text-3xl text-forest">Compare the work you want help with</h2><div className="mt-6 space-y-4">{item.rows.map(row => <div key={row.topic} className="rounded-card border border-sage/40 p-6"><h3 className="font-display text-xl text-forest">{row.topic}</h3><dl className="mt-4 grid gap-5 md:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-widest text-forest/70">{item.name}</dt><dd className="mt-2 leading-relaxed">{row.other}</dd></div><div><dt className="text-xs font-bold uppercase tracking-widest text-forest/70">Place &amp; Plenty</dt><dd className="mt-2 leading-relaxed">{row.pp}</dd></div></dl></div>)}</div><p className="mt-4 text-sm text-forest/70">Comparison based on <a href={item.source} className="underline">{item.name}’s published overview</a>, reviewed September 10, 2026. Features and plan availability can change. This is a focused comparison, not an exhaustive feature audit.</p></section>
      <section className="mt-12 border-y border-gold/50 py-8"><h2 className="font-display text-3xl text-forest">Picture your next gathering</h2><p className="mt-4 max-w-3xl leading-relaxed">{item.scenario}</p><Link href="/gathering-checklists" className="mt-5 inline-block font-semibold underline underline-offset-4">Try a free gathering checklist</Link></section>
      <section className="mt-12"><h2 className="font-display text-3xl text-forest">Start free. Choose paid access when you need it.</h2><div className="mt-6 grid gap-5 md:grid-cols-3">{PRICING_TIERS.map(tier => <div key={tier.name} className="rounded-card border border-sage/40 bg-offwhite p-6"><h3 className="font-display text-xl">{tier.name}</h3><p className="mt-3 font-semibold">{tier.priceLine}</p><p className="mt-3 text-sm leading-relaxed">{tier.description}</p></div>)}</div><p className="mt-4 text-sm">{PURCHASE_AVAILABILITY_NOTE}</p><Link href="/pricing" className="mt-4 inline-block underline underline-offset-4">See full plan limits and availability</Link><p className="mt-4 text-sm leading-relaxed">Compare the full package you need, rather than assuming invitation pricing and gathering access cover the same work. Check <a href={item.source} className="underline">{item.name}</a> for its current options.</p></section>
      <section className="mt-12"><h2 className="font-display text-3xl text-forest">Questions before you choose</h2><div className="mt-5 divide-y divide-sage/40">{faqs.map(faq => <details key={faq.q} className="py-5"><summary className="cursor-pointer font-semibold text-forest">{faq.q}</summary><p className="mt-3 max-w-3xl leading-relaxed">{faq.a}</p></details>)}</div></section>
      <nav aria-label="More ways to plan" className="mt-10 flex flex-wrap gap-6 border-t border-sage/40 pt-7">{COMPARISONS.filter(c => c.slug !== item.slug).map(c => <Link key={c.slug} href={`/compare/${c.slug}`} className="underline underline-offset-4">P&amp;P vs. {c.name}</Link>)}<Link href="/invitations" className="underline underline-offset-4">Explore P&amp;P invitations</Link><Link href="/potluck-planner" className="underline underline-offset-4">Plan a potluck</Link></nav>
      <p className="mt-8 text-xs leading-relaxed text-forest/65">Published by Place &amp; Plenty. {item.name} is a trademark of its respective owner. No affiliation or endorsement is implied.</p>
    </div>
    <CtaBand headline="People are coming." emphasisLine="Let’s get you ready." body="Start a gathering on the website and give the preparation a place to live." />
  </>;
}
