"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, RESET_PASSWORD_PATH } from "@/lib/auth-redirects";

// Request a password-reset email.
//
// THE CONFIRMATION IS DELIBERATELY NEUTRAL, and this is the whole
// security point of the screen. "We've sent you a link" leaks nothing;
// "No account with that email" tells a stranger which addresses are
// registered, which is how account lists get enumerated. So the success
// copy says "if there's an account for that address" and is shown for
// EVERY submission — known address or not.
//
// Supabase cooperates with this: resetPasswordForEmail() does not error
// on an unknown address, precisely so the caller cannot distinguish. The
// neutral message below is therefore honest as well as safe, not a
// convenient fiction.
//
// The one case that does surface an error is rate limiting, because a
// person hammering the button needs to know to stop rather than assuming
// the mail is slow.
//
// The redirect goes to /auth/callback (the single allowlisted URL) with
// next=/reset-password, so the code is exchanged for a session before
// the new-password form is shown. See lib/auth-redirects.ts.

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");

    const supabase = getBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl(window.location.origin, RESET_PASSWORD_PATH),
    });

    if (error) {
      // Rate limiting is the realistic failure and is worth naming.
      // Anything else is reported without echoing whether the address
      // exists.
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
            onClick={() => setStatus("idle")}
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
