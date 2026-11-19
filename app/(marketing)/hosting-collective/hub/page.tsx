import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { collectiveRole } from '@/lib/collective-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = { title: 'Your Collective Hub', robots: { index: false, follow: false } };

export default async function CollectiveHub() {
  const user = await getUser();
  if (!user) redirect('/login?next=%2Fhosting-collective%2Fhub');
  const role = collectiveRole(user);
  if (!role) return <section className="mx-auto max-w-2xl px-6 py-20">
    <p className="font-body text-sm text-goldInk">The Hosting Collective</p>
    <h1 className="mt-4 font-display text-4xl">You’re signed in.</h1>
    <p className="mt-6 font-body text-lg leading-relaxed">This hub is for approved Contributors and Partners. Your account does not have active hub access yet. Applying and joining the community are separate from signing in.</p>
    <div className="mt-8 flex flex-wrap gap-5 font-body font-semibold"><Link className="underline" href="/hosting-collective/apply">Explore partner applications</Link><Link className="underline" href="/hosting-collective">Back to the Collective</Link></div>
    <p className="mt-8 font-body leading-relaxed">If you have already been approved, contact <a className="underline" href="mailto:alexis@placeandplenty.com">alexis@placeandplenty.com</a> using the email associated with your application.</p>
  </section>;

  // Authorize before rendering resources. Never trust signup/user_metadata,
  // query parameters, app subscriptions, or Tally hidden fields for access.
  return <section className="mx-auto max-w-4xl px-6 py-16 md:py-24">
    <p className="font-body text-sm uppercase tracking-widest text-goldInk">Collective {role === 'partner' ? 'Partner' : 'Contributor'}</p>
    <h1 className="mt-4 font-display text-4xl md:text-5xl">Your place in the Collective.</h1>
    <p className="mt-6 font-body text-lg leading-relaxed">Bring your ideas, share what helps, and make gathering feel more achievable for someone else.</p>
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <article className="rounded-card border border-forest/20 bg-parchment p-7"><h2 className="font-display text-2xl">Start with one gathering.</h2><p className="mt-4 font-body leading-relaxed">Choose a real hosting moment. Show a useful idea, use sample guest details, and describe only features you have tried. Clearly disclose any affiliate relationship or gifted access.</p><Link className="mt-5 inline-block font-body font-semibold underline" href="/what-it-does">Explore the product</Link></article>
      <article className="rounded-card border border-forest/20 p-7"><h2 className="font-display text-2xl">Share an idea.</h2><p className="mt-4 font-body leading-relaxed">What would help your community feel ready to welcome people? Send a content idea or tell us what you would like to explore together.</p><a className="mt-5 inline-block font-body font-semibold underline" href="mailto:alexis@placeandplenty.com?subject=Hosting%20Collective%20idea">Contact Alexis</a></article>
    </div>
    {role === 'partner' ? <div className="mt-8 rounded-card bg-parchment p-7"><h2 className="font-display text-2xl">Affiliate participation</h2><p className="mt-4 font-body leading-relaxed">Partner access does not automatically activate affiliate tracking. Affiliate links and earnings will be available after your affiliate terms and tracking are confirmed. Please wait for your activation message before sharing referral offers.</p></div> : null}
    <div className="mt-10 flex flex-wrap gap-6 font-body"><Link className="underline" href="/hosting-collective">Collective overview</Link><Link className="underline" href="/host">My Place & Plenty account</Link><form action="/auth/signout" method="post"><button className="underline" type="submit">Sign out</button></form></div>
  </section>;
}
