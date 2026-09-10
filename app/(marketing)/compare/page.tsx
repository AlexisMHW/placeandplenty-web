import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { BreadcrumbSchema } from "@/components/StructuredData";
import { COMPARISONS } from "@/lib/comparisons";

const title = "Compare Home Hosting & Invitation Tools";
const description = "Explore Place & Plenty vs. Evite and Paperless Post. Compare invitations, guest coordination and home-hosting preparation to find your fit.";
export const metadata: Metadata = { title, description, alternates: { canonical: "/compare" }, openGraph: { title, description, url: "/compare", images: [{ url: "/images/hero-tabletop.jpg" }] }, twitter: { card: "summary_large_image", title, description, images: ["/images/hero-tabletop.jpg"] } };
export default function ComparePage() {
  return <>
    <BreadcrumbSchema items={[{ name: "Home", url: "https://placeandplenty.com" }, { name: "Compare hosting tools", url: "https://placeandplenty.com/compare" }]} />
    <PageHero eyebrow="Compare hosting tools" headline="Find the right help for your gathering." emphasisLine="From invitation to doorbell." body={<p>Invitations bring your people in. Preparation makes room for them. Explore how P&amp;P compares with invitation platforms, and choose the help that fits the way you host.</p>} image="/images/hero-tabletop.jpg" imageAlt="A table set for a warm gathering at home" />
    <section className="mx-auto max-w-editorial px-6 py-12 md:py-16"><h2 className="font-display text-3xl text-forest">What are you comparing?</h2><div className="mt-7 grid gap-7 md:grid-cols-2">{COMPARISONS.map(item => <Link key={item.slug} href={`/compare/${item.slug}`} className="rounded-card border border-gold/60 bg-cream p-7 shadow-soft transition-shadow hover:shadow-lift"><h3 className="font-display text-3xl text-forest">P&amp;P vs. {item.name}</h3><p className="mt-4 leading-relaxed">{item.slug === "evite" ? "Compare invitations, shared dishes and a connected plan for getting your home ready." : "Compare invitation design, guest management and the preparation behind a gathering."}</p><span className="mt-5 inline-block font-semibold underline underline-offset-4">Read the comparison</span></Link>)}</div><div className="mt-12 border-t border-sage/40 pt-8"><h2 className="font-display text-3xl text-forest">Try your own gathering.</h2><p className="mt-4 max-w-2xl leading-relaxed">Start with a dinner, birthday or weekend get-together. See how P&amp;P brings your people, menu, shopping and preparation into one place.</p><div className="mt-6 flex flex-wrap items-center gap-6"><Link href="/signup" className="rounded-full bg-forest px-6 py-3 font-semibold text-offwhite">Start Hosting Free</Link><Link href="/gathering-checklists" className="font-semibold underline underline-offset-4">Get a free gathering checklist</Link></div></div></section>
  </>;
}
