import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
export const metadata: Metadata = {
  title: 'The Place & Plenty Hosting Collective',
  description: 'A community of people who believe gathering should feel welcoming, achievable, and enjoyable.',
  alternates: { canonical: '/hosting-collective' },
  robots: { index: false, follow: false },
};
const levels = [
  { name: 'Collective Member', number: '01', line: 'A place to belong.', body: 'For people who enjoy bringing people together. Receive community updates, explore hosting prompts and discover opportunities to share your ideas.', entry: 'Join the community', href: '/hosting-collective/join' },
  { name: 'Collective Contributor', number: '02', line: 'Your ideas make room for others.', body: 'Selected members share useful hosting ideas, contribute content and take part in collaborative projects. Contributor recognition begins by invitation.', entry: 'Start as a member', href: '/hosting-collective/join' },
  { name: 'Collective Partner', number: '03', line: 'Build something together.', body: 'Approved creators collaborate with Place & Plenty through affiliate sharing, content partnerships or hosting projects. Each commercial opportunity has its own scope and terms.', entry: 'Apply to partner', href: '/hosting-collective/apply' },
];
const button = 'inline-flex items-center justify-center rounded-full px-7 py-3.5 font-body font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';
export default function HostingCollective() {
  return <>
    <section className="bg-forest text-offwhite">
      <div className="mx-auto grid max-w-editorial items-center gap-12 px-6 py-16 md:py-24 lg:grid-cols-2">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-[0.22em] text-gold">The Place & Plenty Hosting Collective</p>
          <h1 className="mt-6 font-display text-5xl leading-[1.08] md:text-6xl">There’s room<br />at this table.</h1>
          <p className="mt-7 max-w-xl font-body text-lg leading-relaxed">A community of people who believe gathering should feel welcoming, achievable, and enjoyable.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/hosting-collective/join" className={`${button} bg-offwhite text-forest`}>Join the Collective</Link>
            <Link href="/hosting-collective/apply" className={`${button} border border-offwhite/60 text-offwhite`}>Apply to Partner</Link>
            <Link href="/hosting-collective/hub" className="self-center px-2 py-3 font-body text-sm underline underline-offset-4">Contributor & Partner sign in</Link>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[6rem] rounded-b-card">
          <Image src="/images/show_us_how_you_gather-hero.png" alt="People gathered around a welcoming table at home" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority />
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-editorial px-6 py-16 md:py-24">
      <div className="max-w-3xl">
        <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">Real homes. Thoughtful ideas. More gathering.</p>
        <h2 className="mt-5 font-display text-3xl leading-tight md:text-5xl">Good company starts with a little confidence.</h2>
        <p className="mt-6 font-body text-lg leading-relaxed">A casual game night. A table made from what you already own. A family celebration with a plan that leaves room to enjoy it. The Collective brings together people who make opening the door feel a little easier.</p>
        <p className="mt-4 font-body text-lg leading-relaxed">Bring your perspective, your practical ideas and your way of welcoming people. A picture-perfect home and an enormous following aren’t prerequisites.</p>
      </div>
    </section>
    <section id="belong" className="bg-parchment">
      <div className="mx-auto max-w-editorial px-6 py-16 md:py-24">
        <h2 className="font-display text-3xl md:text-5xl">Find your way to take part.</h2>
        <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed">Belong, contribute or collaborate. Your contribution can grow in different directions; sales aren’t the only way to make an impact.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">{levels.map(level => <article key={level.name} className="flex flex-col rounded-card border border-forest/15 bg-offwhite p-7 md:p-8">
          <p className="font-body text-sm text-goldInk">{level.number}</p><h3 className="mt-5 font-display text-2xl">{level.name}</h3>
          <p className="mt-4 font-body font-semibold">{level.line}</p><p className="mt-3 grow font-body leading-relaxed">{level.body}</p>
          <Link href={level.href} className="mt-8 font-body font-semibold underline underline-offset-4">{level.entry} →</Link>
        </article>)}</div>
        <p className="mt-8 font-body text-sm leading-relaxed">Collective participation is separate from the app’s Free, Gathering Pass and Plus plans. Membership does not grant paid app access.</p>
      </div>
    </section>
    <section className="mx-auto grid max-w-editorial gap-12 px-6 py-16 md:py-24 lg:grid-cols-2">
      <div><p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">Commercial partnerships</p>
        <h2 className="mt-5 font-display text-3xl md:text-4xl">Affiliate sharing is one way to partner.</h2>
        <p className="mt-5 font-body text-lg leading-relaxed">We also welcome interest in content collaborations and creator-led hosting projects. Paid projects, usage rights and deliverables are agreed separately; opportunities are not guaranteed.</p>
        <Link href="/hosting-collective/apply" className={`${button} mt-7 bg-forest text-offwhite`}>Explore the partner application</Link>
      </div>
      <div className="rounded-card border border-forest/20 p-8">
        <h3 className="font-display text-2xl">The affiliate offering</h3>
        <dl className="mt-6 space-y-5 font-body">
          <div><dt className="font-semibold">$12 per qualifying Plus annual purchase</dt><dd className="mt-1">For a new customer’s first paid purchase.</dd></div>
          <div><dt className="font-semibold">$0.50 per qualifying Gathering Pass purchase</dt><dd className="mt-1">Accrued individually toward the same payout balance.</dd></div>
        </dl>
        <p className="mt-6 font-body text-sm leading-relaxed">Website purchases only. A 30-day attribution window, 45-day validation hold and $50 combined payout minimum apply. Renewals, later upgrades, self-referrals, refunded and disputed purchases do not qualify. Existing Free users can qualify on their first paid purchase.</p>
        <p className="mt-4 font-body text-sm leading-relaxed">Affiliate activation is not open yet. Approved partners receive final terms and a verified link before sharing referral offers.</p>
      </div>
    </section>
    <section className="border-t border-forest/15"><div className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="font-display text-3xl">A few things you might be wondering.</h2>
      {[['Do I need to be a creator to join?', 'No. Collective membership is for people who share an interest in welcoming, achievable gathering. Creator partnerships have a separate application.'],['How do I become a Contributor?', 'Contributors are invited based on useful ideas and participation. There is no points requirement or automatic promotion based on sales.'],['Does Partner mean affiliate?', 'Affiliate Partner is one designation. Content partnerships and hosting projects can be separate relationships, with their own agreements.'],['When can I apply?', 'Member signup and partner applications are being prepared. Each path will open here when ready.']].map(([q,a])=><details key={q} className="border-b border-forest/15 py-5"><summary className="cursor-pointer font-body font-semibold">{q}</summary><p className="mt-3 font-body leading-relaxed">{a}</p></details>)}
    </div></section>
  </>;
}
