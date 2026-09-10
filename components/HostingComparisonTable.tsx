import Link from "next/link";
import { PRICING_TIERS, PURCHASE_AVAILABILITY_NOTE } from "@/lib/pricing";

const unverified = "Not verified";
const rows = [
  { label: "Planning focus", values: ["Connected home-hosting preparation", "Invitation design & guest management", "Invitations & guest coordination", "Social invitations & event coordination"], compact: true },
  { label: "Invitations & RSVPs", values: ["Included in Free", "Cards, Flyers & RSVP tracking", "Invitations, event pages & RSVP tracking", "Custom invitations & RSVP tracking"] },
  { label: "Guest communication", values: ["Guest Communications within your gathering", "Messages, reminders & guest questions", "Guest messaging & reminders", "Guest questions & event updates"] },
  { label: "Who’s bringing what", values: ["Gathering contributions with paid access", unverified, "SignUp Sheets", unverified] },
  { label: "Menu & servings", values: ["My Table", unverified, unverified, unverified] },
  { label: "Shopping list", values: ["My Shopping List", unverified, unverified, unverified] },
  { label: "What you already own", values: ["My Hosting Closet; smart matching with paid access", unverified, unverified, unverified] },
  { label: "Preparation timeline", values: ["Gathering preparation timeline", unverified, unverified, unverified] },
  { label: "Readiness score", values: ["HostReady with paid access", unverified, unverified, unverified] },
  { label: "Free starting point", values: ["$0 · one open gathering", "Free feature set: first 50 invitations sent directly by email or phone", "Free invitations & event pages", "Free invitations"], compact: true },
  { label: "Paid options", values: [`Gathering Pass: ${PRICING_TIERS[1].priceLine} per gathering. Plus: ${PRICING_TIERS[2].priceLine}.`, "Coins per recipient vary by design/features; annual Pro plans by guest count", "Premium invitation options; Pro advertised at $249.99/year", "Invitations advertised as free; ticketing has separate terms"], compact: true },
  { label: "What to weigh", values: ["The people, food, supplies and work before guests arrive", "Design choices, guest count and event-management features", "Invitation options and guest coordination needs", "Invitations and social event coordination"], compact: true },
];
const providers = ["Place & Plenty", "Paperless Post", "Evite", "Partiful"];

/** Shared editorial table; price copy for P&P stays in the existing pricing module. */
export default function HostingComparisonTable({ compact = false }: { compact?: boolean }) {
  const id = compact ? "pricing-comparison" : "hosting-comparison";
  return <section aria-labelledby={`${id}-title`} className="mx-auto max-w-editorial px-6 py-12 md:py-16">
    <p className="text-xs font-bold uppercase tracking-widest text-forest/70">The invitation. And everything around it.</p>
    <h2 id={`${id}-title`} className="mt-3 font-display text-3xl text-forest md:text-4xl">{compact ? "Compare what you’re paying for" : "P&P, Paperless Post, Evite & Partiful — side by side"}</h2>
    <p className="mt-4 max-w-3xl leading-relaxed text-forest/80">{compact ? "A free invitation may be all you need. P&P adds a home for the menu, shopping and preparation, with a free starting point of its own." : "See which tools support the invitation, the guest list and the work of getting your home ready. P&P’s column highlights the preparation you can keep with your gathering."}</p>
    <p className="mt-5 text-sm text-forest/70 lg:hidden">Swipe the table sideways to compare all four. You can also focus the table and use your arrow keys.</p>
    <div role="region" aria-label="Hosting platform comparison table" aria-describedby={`${id}-notes`} tabIndex={0} className="mt-6 overflow-x-auto rounded-card border border-gold/60 shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest">
      <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm leading-relaxed text-forest">
        <caption className="sr-only">{compact ? "Pricing and purpose" : "Features and pricing"} comparison of Place &amp; Plenty, Paperless Post, Evite and Partiful. Reviewed September 10, 2026.</caption>
        <colgroup><col className="w-[16%]" />{providers.map(name => <col key={name} className="w-[21%]" />)}</colgroup>
        <thead><tr><th scope="col" className="sticky left-0 z-10 border-b border-gold/50 bg-parchment p-5 font-semibold">{compact ? "What matters" : "Feature / option"}</th>{providers.map((name,i) => <th key={name} scope="col" className={`border-b border-gold/50 p-5 font-display text-xl ${i === 0 ? "bg-forest text-offwhite" : "bg-cream"}`}>{name}{i===0 && <span className="mt-1 block font-body text-xs font-normal text-offwhite/80">Home Hosting. Made Simple.</span>}</th>)}</tr></thead>
        <tbody>{rows.filter(row=>!compact||row.compact).map(row=><tr key={row.label}><th scope="row" className="sticky left-0 z-10 border-b border-sage/30 bg-parchment p-5 align-top font-semibold">{row.label}</th>{row.values.map((value,i)=><td key={providers[i]} className={`border-b border-sage/30 p-5 align-top ${i===0 ? "bg-cream font-medium" : "bg-offwhite"}`}>{value===unverified ? <span className="text-forest/60">Not verified*</span> : value}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <div id={`${id}-notes`} className="mt-5 space-y-3 text-sm leading-relaxed text-forest/75">
      {!compact && <p><strong>*Not verified</strong> means a dedicated feature was not confirmed in the official pages reviewed. It does not mean the service cannot support that activity. Guest questions or event notes are different from a dedicated menu, inventory or shopping tool.</p>}
      <p>P&amp;P features vary by plan. Plus includes up to 6 open gatherings and 12 locked-in gatherings per annual term. {PURCHASE_AVAILABILITY_NOTE} <Link href="/pricing" className="underline underline-offset-4">See P&amp;P’s full plan details.</Link></p>
      <p>Sources reviewed September 10, 2026: <a href="https://www.paperlesspost.com/" className="underline">Paperless Post features</a>, <a href="https://www.paperlesspost.com/pricing" className="underline">Paperless Post pricing</a>, <a href="https://www.evite.com/" className="underline">Evite features and pricing</a>, and <a href="https://partiful.com/" className="underline">Partiful features and pricing</a>. Competitor pricing is as advertised; final costs and terms may vary. This comparison is published by Place &amp; Plenty and is not affiliated with the other providers.</p>
    </div>
    <div className="mt-7 flex flex-wrap items-center gap-6"><Link href="/signup" className="rounded-full bg-forest px-6 py-3 font-semibold text-offwhite">Start Hosting Free</Link><Link href={compact ? "/compare" : "/gathering-checklists"} className="font-semibold text-forest underline decoration-gold underline-offset-4">{compact ? "See the full feature comparison" : "Try a free gathering checklist"}</Link></div>
  </section>;
}
