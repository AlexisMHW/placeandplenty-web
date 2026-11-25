"use client";

import { useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { COLLABORATIONS, NICHES, PLATFORMS, validateApplication } from "@/lib/hosting-collective";

// Application form. Client validation is a convenience; the server route and the database repeat every check.
export default function CreatorApplicationForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "closed" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      fullName: f.get("fullName"), email: f.get("email"), audienceSummary: f.get("audienceSummary"),
      platforms: [1, 2, 3].map((i) => ({ platform: f.get(`platform${i}`), handle: f.get(`handle${i}`) })),
      niches: f.getAll("niches"), collaborationInterest: f.getAll("collab"),
      priorWorkUrls: [f.get("prior1"), f.get("prior2"), f.get("prior3")],
      disclosureAck: f.get("disclosureAck") === "on", consentToContact: f.get("consentToContact") === "on",
      website: f.get("website"), // honeypot
    };
    const v = validateApplication(input);
    if (!v.ok && !String(input.website ?? "").trim()) { setErrors(v.errors); return; }
    setErrors({}); setStatus("submitting");
    try {
      const res = await fetch("/api/hosting-collective/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const out = await res.json().catch(() => ({}));
      setMessage(typeof out.message === "string" ? out.message : "");
      if (res.ok && out.status === "received") { setStatus("done"); track("partner_application_submit", { entry_point: "application_form" }); }
      else if (res.ok && out.status === "closed") setStatus("closed");
      else { if (out.errors) setErrors(out.errors); setStatus("error"); }
    } catch { setMessage("We couldn't send that. Please try again."); setStatus("error"); }
  }

  if (status === "done") return (
    <div role="status" className="rounded-card border border-olive/30 bg-cream p-8 text-center">
      <p className="font-display text-2xl text-forest">Thank you for applying.</p>
      <p className="mt-2 font-body text-forest/70">{message || "We review every application by hand."} Approval is not automatic. If we need anything else, or if your application moves forward, we will email you.</p>
    </div>
  );
  if (status === "closed") return (
    <div role="status" className="rounded-card border border-olive/30 bg-cream p-8 text-center">
      <p className="font-display text-2xl text-forest">Applications are not open yet.</p>
      <p className="mt-2 font-body text-forest/70">Please check back soon.</p>
    </div>
  );

  const field = "w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest";
  const label = "mb-1 block font-body text-sm font-semibold text-forest";
  const err = (k: string) => errors[k] ? <p role="alert" className="mt-1 text-sm text-error">{errors[k]}</p> : null;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft">
      <div><label htmlFor="hc-name" className={label}>Your name</label><input id="hc-name" name="fullName" required maxLength={120} className={field} />{err("fullName")}</div>
      <div><label htmlFor="hc-email" className={label}>Email</label><input id="hc-email" name="email" type="email" required maxLength={254} className={field} />{err("email")}</div>
      <fieldset><legend className={label}>Where you share your hosting (up to three)</legend>
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[10rem_1fr]">
            <select name={`platform${i}`} aria-label={`Platform ${i}`} className={field} defaultValue={i === 1 ? "instagram" : ""}>
              <option value="">Platform</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input name={`handle${i}`} aria-label={`Handle or link ${i}`} maxLength={200} placeholder="@handle or link" className={field} />
          </div>))}
        {err("platforms")}
      </fieldset>
      <fieldset><legend className={label}>Topics you cover</legend>
        <div className="grid gap-1 sm:grid-cols-2">{NICHES.map(([slug, text]) => (
          <label key={slug} className="flex items-center gap-2 font-body text-sm text-forest"><input type="checkbox" name="niches" value={slug} />{text}</label>))}</div>{err("niches")}
      </fieldset>
      <div><label htmlFor="hc-audience" className={label}>Tell us about your audience</label><textarea id="hc-audience" name="audienceSummary" required rows={4} maxLength={1000} className={field} />{err("audienceSummary")}</div>
      <fieldset><legend className={label}>Examples of your work (optional, https links)</legend>
        {[1, 2, 3].map((i) => <input key={i} name={`prior${i}`} aria-label={`Example ${i}`} maxLength={500} className={`${field} mb-2`} />)}{err("priorWorkUrls")}
      </fieldset>
      <fieldset><legend className={label}>What interests you (optional)</legend>
        <div className="grid gap-1 sm:grid-cols-2">{COLLABORATIONS.map(([slug, text]) => (
          <label key={slug} className="flex items-center gap-2 font-body text-sm text-forest"><input type="checkbox" name="collab" value={slug} />{text}</label>))}</div>
      </fieldset>
      <div className="hidden" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="flex items-start gap-2 font-body text-sm text-forest"><input type="checkbox" name="disclosureAck" className="mt-1" />I understand that anything I publish with a referral link must clearly disclose that I may earn a commission.</label>{err("disclosureAck")}
      <label className="flex items-start gap-2 font-body text-sm text-forest"><input type="checkbox" name="consentToContact" className="mt-1" />Place &amp; Plenty may email me about this application.</label>{err("consentToContact")}
      {status === "error" && message ? <p role="alert" className="text-sm text-error">{message}</p> : null}
      <button disabled={status === "submitting"} className="rounded-full bg-forest px-6 py-3 font-body font-semibold text-parchment disabled:opacity-60">{status === "submitting" ? "Sending..." : "Send my application"}</button>
    </form>
  );
}
