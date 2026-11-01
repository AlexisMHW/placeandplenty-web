import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase-server';
import { canReviewCollective } from '@/lib/collective-access';
import { submissionPage, reviewPageNumber } from '@/lib/collective-submissions';
import { COLLECTIVE_FORMS } from '@/lib/collective';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata: Metadata = {title:'Collective application review',robots:{index:false,follow:false}};

export default async function CollectiveReview({searchParams}:{searchParams:{page?:string}}) {
  const user = await getUser();
  if (!user) redirect('/login?next=%2Fhosting-collective%2Freview');
  if (!canReviewCollective(user)) notFound();
  const page = reviewPageNumber(searchParams.page);
  const apiKey = process.env.TALLY_API_KEY;
  let result: ReturnType<typeof submissionPage> | null = null;
  let notice = 'Application inbox connection is not configured. Intake remains closed.';
  if (apiKey) {
    try {
      const response = await fetch(`https://api.tally.so/forms/${COLLECTIVE_FORMS.apply.id}/submissions?page=${page}&limit=25`,{
        headers:{Authorization:`Bearer ${apiKey}`,'tally-version':'2025-02-01'},cache:'no-store',signal:AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('provider_unavailable');
      result = submissionPage(await response.json());
    } catch { notice = 'The application inbox could not be loaded. No approval or access changes were made. Review submissions in Tally while this connection is checked.'; }
  }
  return <section className="mx-auto max-w-4xl px-6 py-16">
    <p className="font-body text-sm uppercase tracking-widest text-goldInk">Private • reviewer access</p>
    <h1 className="mt-4 font-display text-4xl">Collective applications</h1>
    <p className="mt-5 font-body leading-relaxed">Review audience fit, practical hosting ideas, content quality and disclosure readiness. An application never grants hub access automatically.</p>
    {!result ? <p role="status" className="mt-8 rounded-card bg-parchment p-6 font-body">{notice}</p> : <>
      {result.submissions.length === 0 ? <p className="mt-8 font-body">No applications on this page.</p> : result.submissions.map(submission => <article key={submission.id} className="mt-8 rounded-card border border-forest/20 p-6">
        <h2 className="font-display text-xl">Application {submission.id}</h2><p className="mt-2 font-body text-sm">Submitted {submission.createdAt}</p>
        <dl className="mt-5 space-y-5">{submission.answers.map((answer,index)=><div key={index}><dt className="font-body font-semibold">{answer.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-body">{answer.value || 'Not provided'}</dd></div>)}</dl>
      </article>)}
      <nav aria-label="Application pages" className="mt-8 flex gap-6 font-body">{page>1?<Link className="underline" href={`/hosting-collective/review?page=${page-1}`}>Previous</Link>:null}{result.hasMore?<Link className="underline" href={`/hosting-collective/review?page=${page+1}`}>Next</Link>:null}</nav>
    </>}
    <aside className="mt-10 rounded-card bg-parchment p-6"><h2 className="font-display text-2xl">Decision workflow</h2><p className="mt-4 font-body leading-relaxed">Record the review and decision before inviting a creator. Verify the applicant’s account ownership, retain the accepted terms, and activate Contributor or Partner access only through the approved administrative process. Affiliate activation is separate.</p><p className="mt-3 font-body text-sm">This inbox is read-only. Decision storage, notifications and access activation are not connected yet.</p></aside>
  </section>;
}
