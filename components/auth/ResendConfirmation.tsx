"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl } from "@/lib/auth-redirects";
import {
  authEmailErrorMessage,
  classifyAuthEmailError,
  resendSecondsRemaining,
  retryAfterSeconds,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/resend-cooldown";

// "Send the confirmation email again", with a cooldown and honest errors.
// `justSentAt` lets the sign-up form start the clock from the email it just sent, so the first
// press is not instant. The resend endpoint does not reveal whether an address has an account.
export default function ResendConfirmation({
  email,
  next,
  justSentAt = null,
}: {
  email: string;
  next: string;
  justSentAt?: number | null;
}) {
  const [lastSentAt, setLastSentAt] = useState<number | null>(justSentAt);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (lastSentAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lastSentAt]);

  const remaining = resendSecondsRemaining(lastSentAt, now);
  const locked = busy || remaining > 0 || !email.trim();

  async function resend() {
    if (locked) return;
    setBusy(true);
    setNotice(null);
    const { error } = await getBrowserClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(window.location.origin, next) },
    });
    setBusy(false);
    if (error) {
      if (classifyAuthEmailError(error) === "rate_limited") {
        // Back-date so exactly the provider's wait remains.
        const wait = retryAfterSeconds(error);
        setLastSentAt(Date.now() - (RESEND_COOLDOWN_SECONDS - Math.min(wait, RESEND_COOLDOWN_SECONDS)) * 1000);
        setNow(Date.now());
      }
      setNotice({ kind: "error", text: authEmailErrorMessage(error) });
      return;
    }
    setLastSentAt(Date.now());
    setNow(Date.now());
    setNotice({ kind: "ok", text: "Sent. It can take a minute to arrive." });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={resend}
        disabled={locked}
        className="rounded-lg border border-forest/30 px-4 py-2.5 font-body text-sm font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-60"
      >
        {busy
          ? "Sending…"
          : remaining > 0
            ? `Resend available in ${remaining}s`
            : "Send the confirmation email again"}
      </button>
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 font-body text-sm ${notice.kind === "error" ? "text-error" : "text-forest/80"}`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
