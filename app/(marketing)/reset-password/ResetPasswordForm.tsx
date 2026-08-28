"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";

// Set a new password.
//
// Reached only with a valid recovery session — the server component
// checks that and passes `canReset`. With no session this renders the
// expired state instead of a form that would fail on submit, which is
// the difference between "ask for a new link" and "type this twice and
// then find out".
//
// CONFIRM FIELD IS VALIDATED CLIENT-SIDE ONLY, and that is fine: it
// guards against a typo, not against an attacker. There is nothing to
// gain by mistyping your own new password, so the check belongs where it
// is fastest. The MINIMUM LENGTH is different — it is a real rule, and
// Supabase enforces it server-side regardless of what this form does.
// Checking it here too just means the person finds out before a round
// trip.
//
// autoComplete="new-password" on both fields so password managers offer
// to generate and then to save, rather than autofilling the old one.
//
// LEAKED-PASSWORD PROTECTION is a Supabase project setting (currently
// OFF — it shows up in the security advisors). With it enabled, a
// password found in a breach corpus is rejected here with a clear
// message. Worth turning on: this form is the single highest-value place
// it applies. Noted for the founder rather than silently assumed.

const MIN_LENGTH = 8;

export default function ResetPasswordForm({
  canReset,
}: {
  canReset: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  if (!canReset) {
    return (
      <div className="rounded-card border border-gold bg-cream p-8">
        <h2 className="font-display text-2xl text-forest">
          Request a new link
        </h2>
        <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
          Password reset links can only be used once, and they expire after
          about an hour. Nothing is wrong with your account.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          Send me a new link
        </Link>
        <p className="mt-6 font-body text-sm text-forest/70">
          Or{" "}
          <Link
            href="/login"
            className="underline decoration-gold underline-offset-4 hover:text-forest"
          >
            log in
          </Link>{" "}
          if you remembered it after all.
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-card border border-sage/30 bg-cream p-8">
        <h2 className="font-display text-2xl text-forest">
          Password updated.
        </h2>
        <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
          You&rsquo;re signed in. Use the new password next time — in the app
          as well as here.
        </p>
        <Link
          href="/host"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          Go to My Gatherings
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password.length < MIN_LENGTH) {
      setMessage(`Passwords need to be at least ${MIN_LENGTH} characters.`);
      setStatus("error");
      return;
    }
    if (password !== confirm) {
      setMessage("Those two don't match.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      // Covers the breached-password rejection when leaked-password
      // protection is enabled, and the "same as your old one" case.
      setMessage(error.message);
      setStatus("error");
      return;
    }

    setStatus("done");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft"
    >
      <div>
        <label
          htmlFor="password"
          className="mb-1 block font-body text-sm font-semibold text-forest"
        >
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={MIN_LENGTH}
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
        <p className="mt-1.5 font-body text-sm text-forest/60">
          At least {MIN_LENGTH} characters.
        </p>
      </div>

      <div className="mt-5">
        <label
          htmlFor="confirm"
          className="mb-1 block font-body text-sm font-semibold text-forest"
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
      </div>

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
        {status === "submitting" ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
