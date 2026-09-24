import type { Metadata } from "next";
import Link from "next/link";
import { checklistSignupUrl } from "@/lib/checklist-flow";
import ChecklistCover from "@/components/ChecklistCover";
import { notFound } from "next/navigation";
import ChecklistSignup from "@/components/ChecklistSignup";
import { CHECKLISTS, CHECKLIST_HELP, getChecklist } from "@/lib/checklists";
import { BotanicalBough } from "@/components/Botanical";

export function generateStaticParams() { return CHECKLISTS.map(kit => ({ edition: kit.slug })); }
export function generateMetadata({ params }: { params: { edition: string } }): Metadata {
  const kit = getChecklist(params.edition);
  if (!kit) return {};
  const title = CHECKLIST_HELP[kit.slug].searchTitle;
  const description = kit.slug === "before-the-doorbell" ? "Still getting ready when guests arrive? Get a free hosting checklist to plan ahead, share the work, and make time for yourself with Place & Plenty." : `${kit.name} gathering ideas, practical hosting tips, and a free printable planning checklist. See how Place & Plenty helps you organize it on the web.`;
  return { title, description, alternates: { canonical: `/gathering-checklists/${kit.slug}` }, openGraph: { title: `${title} | Place & Plenty`, description, url: `https://placeandplenty.com/gathering-checklists/${kit.slug}`, images: [kit.image] }, twitter: { card: "summary_large_image", title, description, images: [kit.image] } };
}
export default function ChecklistPage({ params }: { params: { edition: string } }) {
  const kit = getChecklist(params.edition);
  if (!kit) notFound();
  const guidance = CHECKLIST_HELP[kit.slug];
  return <section className="relative overflow-hidden bg-parchment py-12 md:py-20">
    <BotanicalBough className="pointer-events-none absolute -left-20 bottom-0 text-forest/75/20" width={220} />
    <div className="relative mx-auto max-w-editorial px-6">
      <Link href="/gathering-checklists" className="font-body text-sm text-forest/70 underline underline-offset-4">All free gathering checklists</Link>
      <div className="mt-7 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div><p className="font-body text-xs font-bold uppercase tracking-[0.18em] text-forest/75">The Put-Together Get-Together Starter Kit</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-forest md:text-5xl">{kit.slug === "before-the-doorbell" ? kit.headline : `${kit.name} Ideas & Free Hosting Checklist`}</h1>
          <h2 className="mt-5 font-display text-2xl leading-snug text-forest">{kit.slug === "before-the-doorbell" ? "A hosting plan that remembers you need to get ready, too." : kit.headline}</h2>
          <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">{kit.description}</p>
          <div className="mt-7 overflow-hidden rounded-card border border-gold/30"><ChecklistCover kit={kit} priority /></div>
          <p className="mt-3 font-body text-sm italic text-forest/65">{kit.note}</p>
          <h2 className="mt-7 font-display text-2xl text-forest">Inside your checklist</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{kit.sections.map(section => <li key={section.title} className="border-l-2 border-gold pl-3 font-body text-forest/80">{section.title}</li>)}</ul>
        </div>
        <div><ChecklistSignup slug={kit.slug} name={kit.name} /><blockquote className="mt-7 border-l-2 border-gold pl-5"><p className="font-display text-xl text-forest">“I built it for you because I needed it too.”</p><p className="mt-3 font-body text-sm leading-relaxed text-forest/75">A thoughtful place for the details of real-life hosting, from Alexis Hughes-Williams, founder of Place &amp; Plenty.</p></blockquote></div>
      </div>
      <section className="mt-14 border-t border-sage/40 pt-10"><h2 className="font-display text-3xl text-forest">{kit.slug === "before-the-doorbell" ? "Three ways to leave yourself a little breathing room" : `Three ${kit.name} gathering ideas to make your own`}</h2><div className="mt-6 grid gap-6 md:grid-cols-3">{guidance.ideas.map(idea => <article key={idea.title} className="rounded-card border border-sage/30 bg-offwhite p-6"><h3 className="font-display text-xl text-forest">{idea.title}</h3><p className="mt-3 font-body leading-relaxed text-forest/75">{idea.description}</p></article>)}</div></section>
      <section className="mt-12"><h2 className="font-display text-3xl text-forest">Put your checklist to work in Place &amp; Plenty</h2><div className="mt-6 grid gap-6 md:grid-cols-2">{guidance.steps.map(step => <article key={step.task} className="border-l-2 border-gold pl-5"><h3 className="font-display text-xl text-forest">{step.task}</h3><p className="mt-2 font-body text-sm font-bold text-forest/75">{step.feature}</p><p className="mt-2 font-body leading-relaxed text-forest/80">{step.help}</p></article>)}</div><p className="mt-6 font-body text-sm text-forest/70">Your checklist is free. Product features depend on your plan. <Link className="underline underline-offset-4" href="/pricing">Compare plans and Multi-Day access</Link>.</p><Link href={checklistSignupUrl(kit.slug)} className="mt-5 inline-flex rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite">Start My Gathering on the Website</Link></section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: guidance.searchTitle, description: kit.description, url: `https://placeandplenty.com/gathering-checklists/${kit.slug}`, about: { "@type": "Thing", name: `${kit.name} hosting and gathering planning` }, publisher: { "@type": "Organization", name: "Place & Plenty", url: "https://placeandplenty.com" } }).replace(/</g, "\\u003c") }} />
    </div>
  </section>;
}
