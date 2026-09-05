"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, RESET_PASSWORD_PATH } from "@/lib/auth-redirects";
import AuthTurnstile, { authTurnstileEnabled } from "@/components/AuthTurnstile";

// Request a password-reset email. The confirmation remains deliberately
// neutral so an attacker cannot enumerate registered addresses. Turnstile
// protects the recovery endpoint when Supabase Auth CAPTCHA enforcement is on.

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (authTurnstileEnabled && !captchaToken) {
      setMessage("Please complete the quick security check and try again.");
      setStatus("error");
      return;
    }

    setStatus("submitting");

    const supabase = getBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl(window.location.origin, RESET_PASSWORD_PATH),
      ...(authTurnstileEnabled ? { captchaToken } : {}),
    });

    if (error) {
      setCaptchaResetKey((value) => value + 1);
      setMessage(
        error.status === 429
          ? "That's a few requests in a row — give it a minute and try again."
          : "We couldn't send that just now. Please try again in a moment."
      );
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="rounded-card border border-sage/30 bg-cream p-8">
        <h2 className="font-display text-2xl text-forest">Check your email.</h2>
        <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
          If there&rsquo;s a Place &amp; Plenty account for{" "}
          <strong className="font-semibold text-forest">{email}</strong>,
          we&rsquo;ve sent it a link to set a new password.
        </p>
        <p className="mt-3 font-body text-base leading-relaxed text-forest/70">
          The link works once and expires after an hour. If it doesn&rsquo;t
          arrive, check spam — and make sure that&rsquo;s the address
          you&rsquo;re signed up with.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 font-body text-sm">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setCaptchaResetKey((value) => value + 1);
            }}
            className="font-semibold underline decoration-gold underline-offset-4 text-forest"
          >
            Use a different email
          </button>
          <Link
            href="/login"
            className="font-semibold underline decoration-gold underline-offset-4 text-forest"
          >
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft"
    >
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
        autoComplete="email"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
      />
      <p className="mt-2 font-body text-sm text-forest/60">
        The address you use for Place &amp; Plenty.
      </p>

      <AuthTurnstile onToken={setCaptchaToken} resetKey={captchaResetKey} />

      {status === "error" && (
        <p role="alert" className="mt-4 font-body text-sm text-error">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 w-full rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send me a reset link"}
      </button>

      <p className="mt-6 font-body text-sm text-forest/70">
        Remembered it?{" "}
        <Link
          href="/login"
          className="underline decoration-gold underline-offset-4 hover:text-forest"
        >
          Back to log in
        </Link>
        .
      </p>
    </form>
  );
}
