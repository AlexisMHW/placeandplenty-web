import type { Metadata } from "next";
import Link from "next/link";
import ChecklistCover from "@/components/ChecklistCover";
import { CHECKLISTS } from "@/lib/checklists";

export const metadata: Metadata = { title: "Free Gathering Checklists", description: "Free printable gathering checklists for everyday gatherings, Halloween, Friendsgiving, Thanksgiving, and Game Day. Get your checklist and start planning on Place & Plenty today.", alternates: { canonical: "/gathering-checklists" } };

export default function ChecklistsPage() {
  const doorbellKit = CHECKLISTS.find(kit => kit.slug === "before-the-doorbell")!;
  return <section className="bg-parchment py-14 md:py-20"><div className="mx-auto max-w-editorial px-6">
    <p className="font-body text-sm font-semibold uppercase tracking-widest text-forest/75">Free Gathering Checklists</p>
    <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-forest md:text-6xl">The Put-Together<br />Get-Together Starter Kit</h1>
    <p className="mt-6 max-w-2xl font-body text-lg leading-relaxed text-forest/80">People are coming. Let’s make the getting-ready part easier. Pick your occasion for a free, printable checklist you can actually use.</p>
    <Link href="/gathering-checklists/before-the-doorbell" className="mt-8 grid overflow-hidden rounded-card border border-gold bg-cream shadow-soft transition-shadow hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest md:grid-cols-2 md:items-center">
      <ChecklistCover kit={doorbellKit} priority />
      <div className="p-7 md:p-8">
        <p className="font-body text-xs font-bold uppercase tracking-widest text-forest/75">For every occasion</p>
        <h2 className="mt-3 font-display text-3xl text-forest">The doorbell rings. You’re still in a towel.</h2>
        <p className="mt-3 font-body text-forest/80">Let’s make room for getting yourself ready, too. Get the free Before the Doorbell checklist.</p>
        <span className="mt-4 inline-block font-body font-semibold text-forest underline underline-offset-4">Help Me Beat the Doorbell</span>
      </div>
    </Link>
    <div className="mt-10 grid gap-7 md:grid-cols-2">{CHECKLISTS.filter(kit => kit.slug !== "before-the-doorbell").map(kit => <Link key={kit.slug} href={`/gathering-checklists/${kit.slug}`} className="overflow-hidden rounded-card border border-sage/40 bg-offwhite shadow-soft transition-shadow hover:shadow-lift">
      <ChecklistCover kit={kit} />
      <div className="p-7"><p className="font-body text-xs font-bold uppercase tracking-widest text-forest/75">Free printable checklist</p><h2 className="mt-3 font-display text-3xl text-forest">{kit.name} Edition</h2><p className="mt-3 font-body leading-relaxed text-forest/75">{kit.description}</p><span className="mt-5 inline-block font-body font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4">Get My {kit.name} Checklist</span></div>
    </Link>)}</div>
    <div className="mt-12 border-t border-sage/40 pt-8"><h2 className="font-display text-3xl text-forest">Keep the whole plan together.</h2><p className="mt-3 max-w-2xl font-body leading-relaxed text-forest/80">Your checklist is a start. Place &amp; Plenty gives your gathering a home, from the guest list to the shopping. Use the website today.</p><Link href="/signup" className="mt-5 inline-flex rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite">Start Hosting Free</Link></div>
  </div></section>;
}
