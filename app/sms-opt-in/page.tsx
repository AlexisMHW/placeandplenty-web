import type { Metadata } from "next";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import SmsOptInStandalone from "@/components/guest/SmsOptInStandalone";
import { isStandaloneOptInEnabled } from "@/lib/sms-standalone-opt-in";

// Public, no-login page where a person can opt in to Place & Plenty texts with their OWN number.
// Outside the (marketing) and (guest) groups on purpose: a self-contained, quiet page with no app-download push.
// Read the flag per request so flipping the env var needs no rebuild of this page's logic.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Text updates (optional)",
  description: "Optionally get invitations, RSVP reminders and gathering updates from Place & Plenty by text. Consent is never required.",
  alternates: { canonical: "/sms-opt-in" },
  openGraph: { url: "/sms-opt-in" },
};

export default function SmsOptInPage() {
  const open = isStandaloneOptInEnabled();
  return (
    <div className="min-h-screen bg-offwhite">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-2.5 focus:font-body focus:text-sm focus:font-semibold focus:text-offwhite">Skip to content</a>
      <header className="border-b border-sage/20 py-5">
        <div className="mx-auto flex max-w-2xl items-center px-6"><Link href="/" aria-label="Place & Plenty home"><Wordmark /></Link></div>
      </header>
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-10 md:py-16">
        <h1 className="font-display text-3xl leading-tight text-forest md:text-4xl">Get text updates from Place &amp; Plenty (optional)</h1>
        <p className="mt-4 font-body text-lg leading-relaxed text-forest/80">
          If you would like, Place &amp; Plenty can text you invitations, RSVP reminders and updates about gatherings you are part of.
          Texts are optional. You can RSVP, host and use Place &amp; Plenty without them, and you can stop at any time.
        </p>
        <h2 className="mt-8 font-display text-xl text-forest">What you would get</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 font-body text-forest/80">
          <li>Invitations to gatherings</li>
          <li>RSVP reminders</li>
          <li>Updates about a gathering (time, place or plan changes)</li>
        </ul>
        <p className="mt-4 font-body text-sm text-forest/70">
          Messages come from Place &amp; Plenty. Frequency varies, usually a few per gathering. Message and data rates may apply. Reply STOP to any text to opt out, or HELP for help.
          Place &amp; Plenty will only text a number its owner has entered here themselves; a host adding your number to a guest list does not sign you up.
        </p>

        <section className="mt-8 rounded-card border border-sage/30 bg-cream/40 p-6 shadow-softer" aria-labelledby="sms-form-heading" data-testid="sms-opt-in-page-card">
          <h2 id="sms-form-heading" className="font-display text-xl text-forest">Sign up for texts</h2>
          {open ? (
            <div className="mt-4"><SmsOptInStandalone /></div>
          ) : (
            <p className="mt-3 font-body text-forest/80" data-testid="sms-opt-in-coming-soon">
              Text sign-up is not open yet. We will turn it on here once it is ready. Nothing on this page collects your number right now, and you will not receive texts from Place &amp; Plenty until you sign up.
            </p>
          )}
        </section>

        <p className="mt-8 font-body text-sm text-forest/80">
          Read our <Link href="/privacy" className="underline decoration-gold underline-offset-2">Privacy Policy</Link> and <Link href="/terms" className="underline decoration-gold underline-offset-2">Terms</Link>.
          Questions? Visit <Link href="/support" className="underline decoration-gold underline-offset-2">Support</Link>.
        </p>
      </main>
    </div>
  );
}
