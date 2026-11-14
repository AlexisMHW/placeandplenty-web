"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, safeNext } from "@/lib/auth-redirects";
import {
  RESEND_ACCEPTED_MESSAGE,
  formatCooldown,
  resendCooldownRemainingMs,
  resendErrorMessage,
} from "@/lib/auth-messages";

// Self-service "send me a new confirmation link".
//
// ANTI-ABUSE. A one-minute cooldown is kept per browser tab (sessionStorage,
// wrapped in try/catch because storage can be unavailable) on top of
// Supabase's own per-address and per-project email limits, which are the real
// control. The cooldown exists to stop an impatient double-click from burning
// the limit and to make the button feel honest; it is not a security boundary.
//
// NO ENUMERATION. The message shown on success is the same for an address
// that is unregistered, waiting, or already confirmed. Errors other than
// throttling collapse to one generic line.

const STORAGE_KEY = "pp_resend_confirmation_at";

function readLastSent(): number | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLastSent(value: number) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable: the cooldown simply lasts for this render */
  }
}

export default function ResendConfirmation({
  initialEmail = "",
  next,
}: {
  initialEmail?: string;
  next?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    setRemaining(resendCooldownRemainingMs(readLastSent(), Date.now()));
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining(resendCooldownRemainingMs(readLastSent(), Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || remaining > 0) return;
    const address = email.trim();
    if (!address) return;

    setBusy(true);
    setMessage("");
    setIsError(false);

    const supabase = getBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: {
        emailRedirectTo: callbackUrl(window.location.origin, safeNext(next)),
      },
    });

    setBusy(false);

    if (error) {
      setIsError(true);
      setMessage(resendErrorMessage(error));
      return;
    }

    const now = Date.now();
    writeLastSent(now);
    setRemaining(resendCooldownRemainingMs(now, now));
    setMessage(RESEND_ACCEPTED_MESSAGE);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 border-t border-sage/30 pt-5">
      <label
        htmlFor="resend-email"
        className="block font-body text-sm font-semibold text-forest"
      >
        Send a new confirmation link
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="resend-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
        <button
          type="submit"
          disabled={busy || remaining > 0}
          className="shrink-0 rounded-full border border-forest px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest hover:text-offwhite disabled:opacity-60"
        >
          {busy
            ? "Sending…"
            : remaining > 0
              ? `Wait ${formatCooldown(remaining)}`
              : "Send link"}
        </button>
      </div>
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 font-body text-sm leading-relaxed ${
            isError ? "text-error" : "text-forest/80"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
