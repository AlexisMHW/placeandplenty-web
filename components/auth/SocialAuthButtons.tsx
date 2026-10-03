"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, safeNext } from "@/lib/auth-redirects";

type SocialProvider = "google" | "apple";

export default function SocialAuthButtons({
  next,
  context = "login",
}: {
  next?: string;
  context?: "login" | "signup";
}) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  const destination = safeNext(next);

  async function continueWith(provider: SocialProvider) {
    setBusy(provider);
    setError("");

    const supabase = getBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(window.location.origin, destination),
      },
    });

    if (authError) {
      setError(authError.message);
      setBusy(null);
    }
  }

  const verb = context === "signup" ? "Continue" : "Continue";

  return (
    <div>
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => continueWith("google")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-sage/40 bg-white px-5 py-3 font-body text-sm font-semibold text-forest transition-colors duration-300 hover:border-forest/45 hover:bg-cream disabled:opacity-60"
        >
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-sage/40 font-body text-xs font-bold text-forest"
          >
            G
          </span>
          {busy === "google" ? "Opening Google…" : `${verb} with Google`}
        </button>

        <button
          type="button"
          onClick={() => continueWith("apple")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#111111] px-5 py-3 font-body text-sm font-semibold text-white transition-opacity duration-300 hover:opacity-90 disabled:opacity-60"
        >
          <span aria-hidden className="font-body text-base leading-none">●</span>
          {busy === "apple" ? "Opening Apple…" : `${verb} with Apple`}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-error/10 px-4 py-3 font-body text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="my-6 flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-sage/25" />
        <span className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-forest/45">
          or use email
        </span>
        <div className="h-px flex-1 bg-sage/25" />
      </div>
    </div>
  );
}
