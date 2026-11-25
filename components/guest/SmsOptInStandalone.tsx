"use client";

import { useEffect, useRef, useState } from "react";
import {
  PREVIEW_COPY, SMS_PRIVACY_URL_TEXT, SMS_TERMS_URL_TEXT, STANDALONE_CONSENT_WORDING, STANDALONE_COPY as t, REVOKE_COPY as rc, looksLikeUsPhone,
} from "@/lib/sms-standalone-opt-in";

// Standalone guest-entered opt-in form. The checkbox starts UNCHECKED and is never pre-ticked. The honeypot ("website") is visually hidden and
// skipped by assistive tech. "Success" is shown only after the server confirms the consent was recorded.

function WordingWithLinks({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${SMS_TERMS_URL_TEXT}|${SMS_PRIVACY_URL_TEXT})`));
  return (
    <>
      {parts.map((p, i) =>
        p === SMS_TERMS_URL_TEXT || p === SMS_PRIVACY_URL_TEXT
          ? <a key={i} href={`/${p.split("/")[1]}`} className="underline decoration-gold underline-offset-2">{p}</a>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export default function SmsOptInStandalone() {
  const [phone, setPhone] = useState("");
  const [checked, setChecked] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { pending: true }>(null);
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeUsPhone(phone)) return setError(t.needPhone);
    if (!checked) return setError(t.needCheckbox);
    setBusy(true);
    try {
      const res = await fetch("/api/sms-opt-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, accepted: true, website, startedAt: startedAt.current }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok === true) setResult({ pending: true });
      else if (res.status === 429) setError(t.rateLimited);
      else if (res.status === 400 && data?.error === "invalid_phone") setError(t.needPhone);
      else if (res.status === 404 || res.status === 503) setError(t.unavailable);
      else setError(t.failed);
    } catch { setError(t.failed); }
    setBusy(false);
  }

  if (result) {
    return <p role="status" className="rounded-card border border-sage/30 bg-white p-5 font-body text-forest" data-testid="sms-opt-in-success">{t.success}</p>;
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="sms-opt-in-form">
      <div>
        <label htmlFor="sms-phone" className="block font-body text-sm font-bold text-forest">Mobile number</label>
        <input id="sms-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={32} value={phone}
          onChange={(e) => setPhone(e.target.value)} aria-describedby="sms-phone-hint sms-error"
          className="mt-1 w-full rounded-md border border-forest/40 bg-white px-3 py-3 font-body text-base text-forest focus:outline-none focus:ring-2 focus:ring-forest" />
        <p id="sms-phone-hint" className="mt-1 font-body text-xs text-forest/70">US mobile numbers only. Enter your own number.</p>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      <div className="flex items-start gap-3">
        <input id="sms-consent" name="consent" type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-forest" />
        <label htmlFor="sms-consent" className="font-body text-sm leading-relaxed text-forest/90"><WordingWithLinks text={STANDALONE_CONSENT_WORDING} /></label>
      </div>
      <p id="sms-error" role="alert" className="min-h-[1.25rem] font-body text-sm text-red-700">{error}</p>
      <button type="submit" disabled={busy} className="w-full rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 disabled:opacity-60 sm:w-auto">{busy ? "Saving…" : "Sign me up for texts"}</button>
    </form>
  );
}

// "Stop texts": a person revokes their OWN consent by typing their number. No checkbox, no login. Works even if they never received a text.
// "Done" is shown only after the server confirms. The only way back on is replying START to a Place & Plenty text (a later sign-up here never undoes a stop).
export function SmsStopTexts() {
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!looksLikeUsPhone(phone)) return setError(rc.needPhone);
    setBusy(true);
    try {
      const res = await fetch("/api/sms-opt-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", phone, website, startedAt: startedAt.current }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok === true) setDone(true);
      else if (res.status === 429) setError(rc.rateLimited);
      else if (res.status === 400 && data?.error === "invalid_phone") setError(rc.needPhone);
      else if (res.status === 404 || res.status === 503) setError(rc.unavailable);
      else setError(rc.failed);
    } catch { setError(rc.failed); }
    setBusy(false);
  }

  if (done) return <p role="status" className="rounded-card border border-sage/30 bg-white p-5 font-body text-forest" data-testid="sms-stop-success">{rc.success}</p>;
  return (
    <form onSubmit={submit} noValidate className="space-y-5" data-testid="sms-stop-form">
      <div>
        <label htmlFor="sms-stop-phone" className="block font-body text-sm font-bold text-forest">Mobile number to stop</label>
        <input id="sms-stop-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={32} value={phone}
          onChange={(e) => setPhone(e.target.value)} aria-describedby="sms-stop-hint sms-stop-error"
          className="mt-1 w-full rounded-md border border-forest/40 bg-white px-3 py-3 font-body text-base text-forest focus:outline-none focus:ring-2 focus:ring-forest" />
        <p id="sms-stop-hint" className="mt-1 font-body text-xs text-forest/70">US mobile numbers only. Enter your own number.</p>
      </div>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      <p id="sms-stop-error" role="alert" className="min-h-[1.25rem] font-body text-sm text-red-700">{error}</p>
      <button type="submit" disabled={busy} className="w-full rounded-full border-2 border-forest px-6 py-3 font-body font-semibold text-forest focus:outline-none focus:ring-2 focus:ring-forest focus:ring-offset-2 disabled:opacity-60 sm:w-auto">{busy ? "Saving…" : "Stop texts to this number"}</button>
    </form>
  );
}

// Preview (not open): the same consent wording and form layout, but every control is disabled and nothing is sent anywhere.
export function SmsOptInPreview() {
  return (
    <div data-testid="sms-opt-in-preview">
      <p role="status" className="rounded-card border border-gold/40 bg-white p-4 font-body text-forest" data-testid="sms-opt-in-preview-banner">{PREVIEW_COPY.banner}</p>
      <div className="mt-5 space-y-5" aria-disabled="true">
        <div>
          <label htmlFor="sms-preview-phone" className="block font-body text-sm font-bold text-forest">Mobile number</label>
          <input id="sms-preview-phone" type="tel" disabled placeholder="Not accepting numbers yet" className="mt-1 w-full rounded-lg border border-sage/40 bg-offwhite px-4 py-3 font-body text-forest/60" />
        </div>
        <div className="flex items-start gap-3">
          <input id="sms-preview-consent" type="checkbox" disabled checked={false} readOnly className="mt-1 h-5 w-5" />
          <label htmlFor="sms-preview-consent" className="font-body text-sm text-forest/80"><WordingWithLinks text={STANDALONE_CONSENT_WORDING} /></label>
        </div>
        <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-forest/40 px-6 py-3 font-body font-semibold text-offwhite">{PREVIEW_COPY.button}</button>
      </div>
      <p className="mt-4 font-body text-sm text-forest/70">{PREVIEW_COPY.notice}</p>
    </div>
  );
}
