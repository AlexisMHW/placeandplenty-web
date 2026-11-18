"use client";

import { useEffect, useState } from "react";
import { lookupShareInvite, submitShareRsvp, type ShareInviteData } from "@/lib/guest-api";
import { formatShareDate, formatShareTime } from "@/lib/share-invite";
import { SmsHelpLine } from "@/components/guest/SmsOptIn";

type Status = "yes" | "maybe" | "no";

export default function ShareInviteClient({ token, data }: { token: string; data: ShareInviteData }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [location, setLocation] = useState<string | null>(data.displayLocation);
  const [requestStatus, setRequestStatus] = useState<ShareInviteData["requestStatus"]>(data.requestStatus);
  const storageKey = `pp-share-request-${token}`;

  // "After host approval" address: the private request token lives only in this browser, and the address is fetched
  // client-side, so it is never in server-rendered HTML or Open Graph metadata.
  useEffect(() => {
    if (data.locationNote !== "after_approval") return;
    let rt: string | null = null;
    try { rt = window.localStorage.getItem(storageKey); } catch { /* storage unavailable */ }
    if (!rt) return;
    let cancelled = false;
    lookupShareInvite(token, rt).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setRequestStatus(res.data.requestStatus);
      if (res.data.displayLocation) setLocation(res.data.displayLocation);
    });
    return () => { cancelled = true; };
  }, [data.locationNote, token, storageKey]);

  const date = formatShareDate(data.displayDate);
  const endDate = formatShareDate(data.displayEndDate);
  const time = formatShareTime(data.displayTime);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return setError("Please choose Yes, Maybe or No.");
    setBusy(true);
    setError(null);
    const res = await submitShareRsvp(token, {
      name: name.trim(),
      email: email.trim(),
      status,
      adults: status === "no" ? 0 : adults,
      children: status === "no" ? 0 : children,
      note: note.trim() || undefined,
      website,
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      if (res.data?.requestToken) {
        try { window.localStorage.setItem(storageKey, res.data.requestToken); } catch { /* storage unavailable */ }
        setRequestStatus("pending");
      }
    } else if (res.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
    else if (res.status === 409) setError("RSVPs are closed for this gathering.");
    else if (res.status === 400) setError("Please check your name, email and the number of guests (up to 20 adults and 20 children).");
    else setError("Something went wrong. Please try again.");
  }

  return (
    <div className="mx-auto max-w-prose px-6 py-12 md:py-16">
      {data.artwork ? (
        <div className="mb-8 overflow-hidden rounded-card border border-sage/30 bg-cream shadow-soft">
          {data.artwork.mimeType === "application/pdf" ? (
            <a
              href={data.artwork.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 text-center font-body text-sm font-semibold text-forest underline decoration-gold underline-offset-4"
            >
              View invitation (PDF)
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.artwork.url} alt={`Invitation to ${data.displayName}`} className="h-auto w-full object-contain" />
          )}
        </div>
      ) : (
        <p className="mb-2 font-body text-xs font-bold uppercase tracking-[0.2em] text-goldInk">
          {data.hostDisplayName ? `${data.hostDisplayName} invited you` : "You're invited"}
        </p>
      )}

      <h1 className="font-display text-3xl text-forest md:text-4xl">{data.displayName}</h1>
      <div className="mt-4 space-y-1 font-body text-forest/80">
        {date && <p>{endDate ? `${date} – ${endDate}` : date}</p>}
        {time && <p>{time}</p>}
        {location && <p>{location}</p>}
        {!location && data.locationNote === "after_approval" && (
          <p className="text-forest/70">
            {requestStatus === "pending"
              ? "The address will appear here once the host approves your RSVP. Check back on this page."
              : "The host shares the address with guests after they approve an RSVP."}
          </p>
        )}
      </div>
      {data.displayDescription && <p className="mt-4 font-body text-forest/80">{data.displayDescription}</p>}

      {data.cancellationMessage && (
        <p className="mt-6 rounded-md border border-sage/40 bg-cream p-4 font-body text-forest">{data.cancellationMessage}</p>
      )}

      {data.canRsvp && !done && (
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <h2 className="font-display text-2xl text-forest">RSVP</h2>
          <label className="block font-body text-sm text-forest">
            Your name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest"
            />
          </label>
          <label className="block font-body text-sm text-forest">
            Your email
            <input
              required
              type="email"
              inputMode="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest"
            />
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Will you come?">
            {(["yes", "maybe", "no"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
                aria-pressed={status === opt}
                className={`rounded-full border px-5 py-2 font-body text-sm capitalize transition-colors ${
                  status === opt ? "border-forest bg-forest text-offwhite" : "border-sage/40 text-forest hover:bg-sage/10"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          {status && status !== "no" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block font-body text-sm text-forest">
                Adults
                <input type="number" min={0} max={20} value={adults} onChange={(e) => setAdults(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest" />
              </label>
              <label className="block font-body text-sm text-forest">
                Children
                <input type="number" min={0} max={20} value={children} onChange={(e) => setChildren(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest" />
              </label>
            </div>
          )}
          <label className="block font-body text-sm text-forest">
            Note for the host (optional)
            <textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              className="mt-1 w-full rounded-md border border-sage/40 bg-white px-3 py-2 text-forest" />
          </label>
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label>Leave this empty<input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          {error && <p role="alert" className="font-body text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-forest px-6 py-3 font-body font-semibold text-offwhite disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send RSVP"}
          </button>
        </form>
      )}

      {done && (
        <div className="mt-8 rounded-md border border-sage/40 bg-cream p-5 font-body text-forest" role="status">
          <p className="font-semibold">Thank you! Your response has been sent to the host.</p>
          <p className="mt-2 text-forest/80">
            If you were already on the guest list, keep using your personal invitation link from your email to change
            an earlier response. The host reviews new responses.
          </p>
        </div>
      )}
      {/* Opt-out / HELP line only (renders nothing unless NEXT_PUBLIC_SMS_GUEST_OPT_IN === "true"). The share link has no household, so the opt-in box lives on the personal /invite link. */}
      <SmsHelpLine />
    </div>
  );
}
