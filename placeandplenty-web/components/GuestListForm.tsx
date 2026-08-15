"use client";

import { useState, FormEvent } from "react";
import { submitGuestListSignup } from "@/lib/supabase";
import { track } from "@/lib/analytics";

const gatheringOptions = [
  "Birthday",
  "Dinner",
  "Halloween",
  "Thanksgiving",
  "Holiday Gathering",
  "Brunch",
  "Shower",
  "Cookout",
  "Other",
];

export default function GuestListForm() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [gatheringType, setGatheringType] = useState("");
  const [consent, setConsent] = useState(true);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName || !email) return;
    setStatus("submitting");

    const { error } = await submitGuestListSignup({
      first_name: firstName,
      email,
      upcoming_gathering_type: gatheringType || undefined,
      source: "website_guest_list",
      consent,
    });

    if (error) {
      setStatus("error");
      return;
    }

    track("guest_list_signup_completed");
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-olive/30 bg-cream p-8 text-center">
        <p className="font-display text-2xl text-forest">
          You&rsquo;re on the Guest List.
        </p>
        <p className="mt-2 font-body text-forest/70">
          We&rsquo;ll let you know when it&rsquo;s time to gather.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft"
      aria-describedby={status === "error" ? "guest-list-error" : undefined}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block font-body text-sm font-semibold text-forest"
          >
            First name
          </label>
          <input
            id="firstName"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block font-body text-sm font-semibold text-forest"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
      </div>

      <div className="mt-5">
        <label
          htmlFor="gatheringType"
          className="mb-1 block font-body text-sm font-semibold text-forest"
        >
          What are you hosting next?{" "}
          <span className="font-normal text-forest/50">(optional)</span>
        </label>
        <select
          id="gatheringType"
          value={gatheringType}
          onChange={(e) => setGatheringType(e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        >
          <option value="">Select one</option>
          {gatheringOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-start gap-2">
        <input
          id="consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="consent" className="font-body text-xs text-forest/60">
          I&rsquo;d like to receive email updates from Place &amp; Plenty.
        </label>
      </div>

      {status === "error" && (
        <p id="guest-list-error" className="mt-4 font-body text-sm text-error">
          Something went wrong submitting that. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
      >
        {status === "submitting" ? "Joining…" : "Join the Guest List"}
      </button>
    </form>
  );
}
