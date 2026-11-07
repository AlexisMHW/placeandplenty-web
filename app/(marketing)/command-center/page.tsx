import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { canReviewCollective } from '@/lib/collective-access';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {title:'Command Center',robots:{index:false,follow:false}};
export default async function CommandCenter() {
  const user = await getUser();
  if (!user) redirect('/login?next=%2Fcommand-center');
  if (!canReviewCollective(user)) notFound();
  return <section className="mx-auto max-w-editorial px-6 py-16 md:py-20">
    <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-goldInk">Place & Plenty • Private administration</p>
    <h1 className="mt-4 font-display text-4xl md:text-5xl">Command Center</h1>
    <p className="mt-5 max-w-2xl font-body text-lg leading-relaxed">Your place to review the Collective, follow up on applications and see what needs attention.</p>
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <article className="rounded-card border border-forest/20 bg-parchment p-8">
        <p className="font-body text-sm font-semibold">Collective</p><h2 className="mt-3 font-display text-3xl">Partner applications</h2>
        <p className="mt-4 font-body leading-relaxed">Review submitted profiles, content examples and partnership interests. Application decisions and access activation remain manual.</p>
        <p className="mt-4 font-body text-sm">{process.env.TALLY_API_KEY ? 'Inbox credential configured. Open the queue to check the connection.' : 'Inbox connection needs setup. Review remains available in your Tally workspace.'}</p>
        <Link href="/command-center/applications" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite">Open application queue</Link>
      </article>
      <article className="rounded-card border border-forest/20 p-8"><p className="font-body text-sm font-semibold">Attention needed</p><h2 className="mt-3 font-display text-3xl">Before intake opens</h2><ul className="mt-5 list-disc space-y-3 pl-5 font-body leading-relaxed"><li>Verify application notifications and a test submission.</li><li>Connect decision recording and account verification.</li><li>Confirm final affiliate tracking and payout rules.</li></ul><Link href="/hosting-collective" className="mt-6 inline-block font-body font-semibold underline">View the Collective pages</Link></article>
      <article className="rounded-card border border-forest/20 p-8"><h2 className="font-display text-2xl">Affiliate program</h2><p className="mt-4 font-body leading-relaxed">Not active. Referrals, commissions and payout reviews will appear after the provider configuration is verified. No earnings or payout figures are available here yet.</p></article>
      <article className="rounded-card border border-forest/20 p-8"><h2 className="font-display text-2xl">Marketing, PR & business overview</h2><p className="mt-4 font-body leading-relaxed">These connections are planned. Continue using your existing campaign and outreach tools until they are connected here.</p></article>
    </div>
    <form action="/auth/signout" method="post" className="mt-10"><button className="font-body underline underline-offset-4" type="submit">Sign out</button></form>
  </section>;
}
