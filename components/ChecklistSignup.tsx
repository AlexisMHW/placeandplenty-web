"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { checklistSignupUrl, checklistLoginUrl } from "@/lib/checklist-flow";
import { track } from "@/lib/analytics";

export default function ChecklistSignup({ slug, name }: { slug: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ download: string; emailSent: boolean; emailConfigured?: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    // Deliberately never include names/emails in URLs or analytics.
    track("checklist_requested", { edition: slug });
    try {
      const response = await fetch("/api/checklists", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition: slug, firstName: data.get("firstName"), email: data.get("email"), consent: data.get("consent") === "on", website: data.get("website") }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "We couldn't save your request. Please try again.");
      setResult(body);
      track("checklist_signup_completed", { edition: slug });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again in a moment."); }
    finally { setBusy(false); }
  }

  if (result) return (
    <div role="status" className="rounded-card border border-gold/60 bg-cream p-7 shadow-soft sm:p-9">
      <p className="font-body text-sm font-semibold text-olive">A little less to keep in your head.</p>
      <h2 className="mt-3 font-display text-3xl text-forest">Your {name} checklist is ready.</h2>
      <a href={result.download} download onClick={() => track("checklist_downloaded", { edition: slug })} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite">Download My Free Checklist</a>
      <p className="mt-3 font-body text-sm leading-relaxed text-forest/75">{result.emailSent ? "A copy has also been requested by email. Check your inbox in a few minutes." : result.emailConfigured ? "Download your copy here now. We couldn't email a copy this time, so keep this download somewhere handy." : "Save your copy here so it is handy when you start getting ready."}</p>
      <div className="mt-7 border-t border-sage/40 pt-6">
        <h3 className="font-display text-2xl text-forest">Now give your plan a place to live.</h3>
        <p className="mt-3 font-body leading-relaxed text-forest/80">Bring your people, menu, and preparation into Place &amp; Plenty. Create your gathering, choose an invitation, and add your people. Preview the invitation, then send it when you are ready. No app download needed.</p>
        <Link href={checklistSignupUrl(slug)} onClick={() => track("checklist_account_clicked", { edition: slug })} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-forest px-5 py-3 text-center font-body font-semibold text-forest">Create My Free Website Account</Link>
        <p className="mt-3 font-body text-sm text-forest/70">Already have an account? <Link className="underline underline-offset-4" href={checklistLoginUrl(slug)}>Start This Gathering</Link></p>
        {(slug === "bachelorette-weekend" || slug === "family-reunion") && <p className="mt-3 font-body text-sm text-forest/70">The checklist is free. Choose a single-day gathering to start free; Multi-Day planning requires access under your plan and current purchase availability.</p>}
        <p className="mt-3 font-body text-xs text-forest/60">Requesting a checklist does not create a website account.</p>
      </div>
      <Link className="mt-6 inline-block font-body text-sm text-forest underline underline-offset-4" href="/gathering-checklists">Explore the other free checklists</Link>
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-card border border-sage/40 bg-offwhite p-7 shadow-soft sm:p-9">
      <h2 className="font-display text-3xl text-forest">Get your free {name} checklist.</h2>
      <p className="mt-3 font-body leading-relaxed text-forest/75">A printable checklist, gathering ideas, and a guide to putting your plan to work in P&amp;P. Download it right after you sign up.</p>
      <label className="mt-6 block font-body text-sm font-semibold text-forest" htmlFor="checklist-first-name">First name</label>
      <input id="checklist-first-name" name="firstName" autoComplete="given-name" required maxLength={120} className="mt-2 min-h-12 w-full rounded-lg border border-sage/50 bg-white px-4 text-forest" />
      <label className="mt-4 block font-body text-sm font-semibold text-forest" htmlFor="checklist-email">Email address</label>
      <input id="checklist-email" name="email" type="email" autoComplete="email" required maxLength={320} className="mt-2 min-h-12 w-full rounded-lg border border-sage/50 bg-white px-4 text-forest" />
      <div aria-hidden="true" className="hidden"><label htmlFor="checklist-website">Leave empty</label><input id="checklist-website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <label className="mt-5 flex items-start gap-3 font-body text-sm leading-relaxed text-forest/80"><input name="consent" type="checkbox" className="mt-1 h-4 w-4 shrink-0" />Send me hosting ideas and Place &amp; Plenty updates from Alexis, too. I can unsubscribe anytime.</label>
      <p className="mt-4 font-body text-xs leading-relaxed text-forest/65">We use your details to fulfill your checklist request. Hosting emails are optional. <Link href="/privacy" className="underline">Privacy policy</Link>.</p>
      {error && <p role="alert" className="mt-4 font-body text-sm text-error">{error}</p>}
      <button disabled={busy} className="mt-6 min-h-12 w-full rounded-full bg-forest px-5 py-3 font-body font-semibold text-offwhite disabled:opacity-60">{busy ? "Getting your checklist…" : (slug === "before-the-doorbell" ? "Help Me Beat the Doorbell" : "Get My Free Checklist")}</button>
      <p className="mt-4 text-center font-body text-sm text-forest/70">Ready to plan now? <Link href={checklistSignupUrl(slug)} className="font-semibold underline underline-offset-4">Start free on the website</Link>.</p>
    </form>
  );
}
