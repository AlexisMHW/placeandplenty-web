import type { Metadata } from "next";
import Link from "next/link";

// HOSTING COLLECTIVE LANDING (proposed). Not linked from navigation or the sitemap and marked noindex until the owner approves launch.
// Copy rules: no income or earnings claims, no promised compensation, no guarantee of approval, no commission rate (rates are not decided).
export const metadata: Metadata = {
  title: "The Hosting Collective",
  description: "A small group of creators who show how real people host in real homes. Apply to be considered.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/hosting-collective" },
};

export default function HostingCollectivePage() {
  return (
    <>
      <section className="bg-offwhite py-20 md:py-28">
        <div className="mx-auto max-w-editorial px-6">
          <p className="font-body text-sm font-semibold uppercase tracking-wide text-goldInk">The Hosting Collective</p>
          <h1 className="mt-3 max-w-prose font-display text-4xl leading-tight text-forest md:text-5xl">Show how real people host in real homes.</h1>
          <p className="mt-5 max-w-prose font-body text-lg leading-relaxed text-forest/80">
            The Hosting Collective is a small group of creators who share honest, prepared-not-perfect hosting. Place &amp; Plenty helps a host get ready
            so they can enjoy their own gathering: preparation creates room for presence.
          </p>
          <Link href="/hosting-collective/apply" className="mt-8 inline-block rounded-full bg-forest px-6 py-3 font-body font-semibold text-parchment">Apply to be considered</Link>
        </div>
      </section>
      <section className="bg-parchment py-16">
        <div className="mx-auto grid max-w-editorial gap-8 px-6 md:grid-cols-3">
          {[
            ["Apply", "Tell us where you share and what you cover. We read every application ourselves. Approval is not automatic and not guaranteed."],
            ["If approved", "You receive a creator guide, our brand kit and a personal referral link. You use Place & Plenty yourself and share it in your own voice."],
            ["How it works", "When someone you referred becomes a qualifying paying customer, a commission can be tracked for you. The details are shared with approved creators before you share anything. We do not pay for content unless a separate written agreement says so."],
          ].map(([t, b]) => (
            <div key={t}><h2 className="font-display text-xl text-forest">{t}</h2><p className="mt-2 font-body leading-relaxed text-forest/80">{b}</p></div>))}
        </div>
      </section>
      <section className="bg-offwhite py-16">
        <div className="mx-auto max-w-prose px-6">
          <h2 className="font-display text-2xl text-forest">Our standards</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 font-body leading-relaxed text-forest/80">
            <li>Say what you actually did and saw. No claims about savings, time saved or guest outcomes that we have not approved.</li>
            <li>Disclose clearly whenever a post includes your referral link. Disclosure is your responsibility.</li>
            <li>Your content stays yours. Joining gives Place &amp; Plenty no rights to reuse it; we ask separately, piece by piece, and you can always say no.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
