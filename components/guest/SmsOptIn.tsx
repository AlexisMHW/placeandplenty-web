"use client";

import { useEffect, useState } from "react";
import {
  SMS_CONSENT_WORDING, SMS_COPY, SMS_PRIVACY_URL_TEXT, SMS_TERMS_URL_TEXT, SMS_WORDING_VERSION,
  isSmsGuestOptInEnabled, pickSmsLocale, type SmsLocale,
} from "@/lib/sms-guest-consent";

// Guest SMS opt-in. Renders NOTHING unless NEXT_PUBLIC_SMS_GUEST_OPT_IN === "true" (default off). The checkbox starts UNCHECKED and is never
// pre-ticked, hidden or implied by the RSVP. The wording shown is exactly the wording the server records for the version we send.

function useSmsLocale(): SmsLocale {
  const [locale, setLocale] = useState<SmsLocale>("en");
  useEffect(() => { setLocale(pickSmsLocale(typeof navigator !== "undefined" ? navigator.language : "en")); }, []);
  return locale;
}

/** The wording with its two web addresses made tappable (the stored text keeps them as plain text). */
function WordingWithLinks({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${SMS_TERMS_URL_TEXT}|${SMS_PRIVACY_URL_TEXT})`));
  return (
    <>
      {parts.map((p, i) =>
        p === SMS_TERMS_URL_TEXT || p === SMS_PRIVACY_URL_TEXT ? (
          <a key={i} href={`/${p.split("/")[1]}`} target="_blank" rel="noopener noreferrer" className="underline decoration-gold underline-offset-2">{p}</a>
        ) : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function SmsHelpLine() {
  const locale = useSmsLocale();
  if (!isSmsGuestOptInEnabled()) return null;
  return <p className="mt-6 font-body text-xs text-forest/70" data-testid="sms-help-line">{SMS_COPY[locale].helpLine}</p>;
}

export default function SmsOptIn({ publicToken }: { publicToken: string }) {
  const locale = useSmsLocale();
  const [checked, setChecked] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { stillOptedOut: boolean }>(null);
  if (!isSmsGuestOptInEnabled()) return null;
  const t = SMS_COPY[locale];
  const wording = SMS_CONSENT_WORDING[SMS_WORDING_VERSION[locale]];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!checked) return setError(t.needCheckbox);
    if (phone.replace(/\D/g, "").length < 10) return setError(t.needPhone);
    setBusy(true);
    try {
      const res = await fetch("/api/sms-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicToken, phone, accepted: true, locale }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) setResult({ stillOptedOut: data.stillOptedOut === true });
      else if (res.status === 429) setError(t.rateLimited);
      else if (res.status === 400 && data?.error === "invalid_phone") setError(t.needPhone);
      else if (res.status === 404 || res.status === 503) setError(t.unavailable);
      else setError(t.failed);
    } catch { setError(t.failed); }
    setBusy(false);
  }

  return (
    <section className="mt-8 rounded-card border border-sage/30 bg-offwhite p-6 shadow-softer" aria-labelledby="sms-optin-heading" data-testid="sms-opt-in">
      <h2 id="sms-optin-heading" className="font-display text-xl text-forest">{t.heading}</h2>
      {result ? (
        <p className="mt-4 font-body text-forest/80" role="status">{result.stillOptedOut ? t.successStillOptedOut : t.success}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
          <p className="font-body text-sm text-forest/70">{t.intro}</p>
          <label className="block font-body text-sm text-forest">
            {t.phoneLabel}
            <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest" aria-describedby="sms-phone-hint" />
            <span id="sms-phone-hint" className="mt-1 block text-xs text-forest/60">{t.phoneHint}</span>
          </label>
          <label className="flex items-start gap-3 font-body text-xs leading-relaxed text-forest/80">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span><WordingWithLinks text={wording} /></span>
          </label>
          {error && <p role="alert" className="font-body text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite disabled:opacity-60">{busy ? t.sending : t.submit}</button>
        </form>
      )}
      <p className="mt-4 font-body text-xs text-forest/60">{t.helpLine}</p>
    </section>
  );
}
