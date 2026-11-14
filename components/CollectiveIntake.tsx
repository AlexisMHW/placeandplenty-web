import Link from 'next/link';
import { COLLECTIVE_FORMS } from '@/lib/collective';

export default function CollectiveIntake({ kind }: { kind: keyof typeof COLLECTIVE_FORMS }) {
  const form = COLLECTIVE_FORMS[kind];
  return <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
    <Link href="/hosting-collective" className="font-body text-sm underline underline-offset-4">← The Hosting Collective</Link>
    <p className="mt-10 font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">Welcoming. Achievable. Enjoyable.</p>
    <h1 className="mt-4 font-display text-4xl md:text-6xl">{form.title}</h1>
    <p className="mt-6 font-body text-lg leading-relaxed">{kind === 'join'
      ? 'A place for people who love bringing people together. Share your interests and receive Collective updates, hosting prompts and opportunities to contribute.'
      : 'Tell us about your community and the ideas you would enjoy creating with Place & Plenty. Every application is reviewed personally.'}</p>
    {form.open ? <>
      <iframe title={form.title} src={`https://tally.so/embed/${form.id}?transparentBackground=1`} loading="lazy" className="mt-10 min-h-[1000px] w-full border-0" referrerPolicy="strict-origin-when-cross-origin" />
      <p className="mt-4 font-body text-sm">Having trouble with the form? <a className="underline" href={`https://tally.so/r/${form.id}`} target="_blank" rel="noopener noreferrer">Open it in a new tab</a>.</p>
    </> : <div className="mt-10 rounded-card border border-forest/20 bg-parchment p-8">
      <h2 className="font-display text-2xl">Opening soon</h2>
      <p className="mt-3 font-body leading-relaxed">{kind === 'join' ? 'We’re preparing to welcome members. Please check back to join.' : 'We’re preparing the partner application and onboarding experience. Please check back to apply.'}</p>
      <Link href="/hosting-collective#belong" className="mt-5 inline-block font-body font-semibold underline underline-offset-4">Explore ways to take part</Link>
    </div>}
    <p className="mt-8 font-body text-sm leading-relaxed">Collective membership is separate from Free, Gathering Pass and Plus app access. Partner application approval does not activate affiliate commissions. <Link className="underline" href="/privacy">Privacy notice</Link></p>
  </section>;
}
