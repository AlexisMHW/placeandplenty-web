"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { submitGuestListSignup } from "@/lib/supabase";
import { track } from "@/lib/analytics";

function compactSource(topic: string) {
  if (typeof window === "undefined") return `seo:${topic}`;

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get("utm_source");
  const utmCampaign = params.get("utm_campaign");
  let ref = "";
  try {
    ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    ref = "";
  }

  return [
    `seo:${topic}`,
    utmSource ? `src=${utmSource}` : "",
    utmCampaign ? `camp=${utmCampaign}` : "",
    ref ? `ref=${ref}` : "",
  ]
    .filter(Boolean)
    .join(";")
    .slice(0, 120);
}

export default function SearchLeadCapture({
  topic,
  gatheringType,
  title,
  body,
  buttonLabel = "Get the planning guide",
}: {
  topic: string;
  gatheringType: string;
  title: string;
  body: string;
  buttonLabel?: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const source = useMemo(() => compactSource(topic), [topic]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!firstName || !email || status === "submitting") return;

    track("guest_list_signup_started", { topic, source });
    setStatus("submitting");

    const result = await submitGuestListSignup({
      first_name: firstName,
      email,
      upcoming_gathering_type: gatheringType,
      source,
      consent,
    });

    if (!result.ok) {
      setStatus("error");
      return;
    }

    track("guest_list_signup_completed", { topic, source });
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-gold/50 bg-cream p-7 shadow-soft md:p-9">
        <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">
          You&rsquo;re in.
        </p>
        <h2 className="mt-3 font-display text-3xl text-forest">Keep the weekend moving.</h2>
        <p className="mt-3 max-w-2xl font-body leading-relaxed text-forest/75">
          We&rsquo;ll send planning help for this kind of gathering. When you&rsquo;re ready to move from ideas into one working plan, start the gathering in Place &amp; Plenty.
        </p>
        <Link
          href="/signup?next=%2Fhost"
          className="mt-6 inline-flex rounded-full bg-forest px-6 py-3 font-body text-sm font-semibold text-offwhite"
        >
          Start My Gathering Free
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-card border border-sage/30 bg-offwhite p-7 shadow-soft md:p-9"
    >
      <p className="font-body text-[0.68rem] font-bold uppercase tracking-[0.18em] text-forest/60">
        Free planning help
      </p>
      <h2 className="mt-3 font-display text-3xl leading-tight text-forest">{title}</h2>
      <p className="mt-3 max-w-2xl font-body leading-relaxed text-forest/75">{body}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${topic}-first-name`} className="mb-1 block font-body text-sm font-semibold text-forest">
            First name
          </label>
          <input
            id={`${topic}-first-name`}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            maxLength={120}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-3 font-body text-forest"
          />
        </div>
        <div>
          <label htmlFor={`${topic}-email`} className="mb-1 block font-body text-sm font-semibold text-forest">
            Email
          </label>
          <input
            id={`${topic}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={320}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-3 font-body text-forest"
          />
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 font-body text-xs text-forest/60">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1"
        />
        I&rsquo;d like planning ideas and product updates from Place &amp; Plenty.
      </label>

      {status === "error" && (
        <p className="mt-4 font-body text-sm text-error" role="alert">
          That did not go through. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-forest px-6 py-3.5 font-body text-sm font-semibold text-offwhite disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? "Saving…" : buttonLabel}
      </button>
    </form>
  );
}
