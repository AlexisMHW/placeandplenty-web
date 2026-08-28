"use client";

import { useState, FormEvent } from "react";
import { submitFoundingHostApplication } from "@/lib/supabase";
import { track } from "@/lib/analytics";

export default function FoundingHostForm() {
  const [form, setForm] = useState({
    first_name: "",
    email: "",
    hosting_what: "",
    gathering_date: "",
    estimated_guest_count: "",
    hosting_frequency: "",
    interest_reason: "",
  });
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState(
    "Something went wrong submitting that. Please try again."
  );

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.first_name || !form.email || !form.hosting_what) return;
    setStatus("submitting");

    const result = await submitFoundingHostApplication(form);

    if (!result.ok) {
      setErrorMessage(
        result.reason === "invalid"
          ? result.message
          : "Something went wrong submitting that. Please try again."
      );
      setStatus("error");
      return;
    }

    track("founding_host_application_completed");
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="rounded-card border border-olive/30 bg-cream p-8 text-center">
        <p className="font-display text-2xl text-forest">
          Thanks for applying.
        </p>
        <p className="mt-2 font-body text-forest/70">
          We&rsquo;ll be in touch as we bring on Founding Hosts.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fh-first-name" className="mb-1 block font-body text-sm font-semibold text-forest">
            First name
          </label>
          <input
            id="fh-first-name"
            required
            maxLength={120}
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
        <div>
          <label htmlFor="fh-email" className="mb-1 block font-body text-sm font-semibold text-forest">
            Email
          </label>
          <input
            id="fh-email"
            type="email"
            required
            maxLength={320}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="fh-hosting-what" className="mb-1 block font-body text-sm font-semibold text-forest">
          What are you hosting?
        </label>
        <input
          id="fh-hosting-what"
          required
          maxLength={200}
          value={form.hosting_what}
          onChange={(e) => update("hosting_what", e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fh-date" className="mb-1 block font-body text-sm font-semibold text-forest">
            Gathering date
          </label>
          <input
            id="fh-date"
            type="date"
            value={form.gathering_date}
            onChange={(e) => update("gathering_date", e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
        <div>
          <label htmlFor="fh-guests" className="mb-1 block font-body text-sm font-semibold text-forest">
            Estimated guest count
          </label>
          <input
            id="fh-guests"
            maxLength={60}
            value={form.estimated_guest_count}
            onChange={(e) => update("estimated_guest_count", e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="fh-frequency" className="mb-1 block font-body text-sm font-semibold text-forest">
          How often do you host?
        </label>
        <input
          id="fh-frequency"
          maxLength={120}
          value={form.hosting_frequency}
          onChange={(e) => update("hosting_frequency", e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
      </div>

      <div className="mt-5">
        <label htmlFor="fh-why" className="mb-1 block font-body text-sm font-semibold text-forest">
          Why are you interested?
        </label>
        <textarea
          id="fh-why"
          rows={4}
          maxLength={4000}
          value={form.interest_reason}
          onChange={(e) => update("interest_reason", e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
      </div>

      {status === "error" && (
        <p role="alert" className="mt-4 font-body text-sm text-error">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
      >
        {status === "submitting" ? "Submitting…" : "Become a Founding Host"}
      </button>
    </form>
  );
}
