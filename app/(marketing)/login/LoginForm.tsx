"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, safeNext } from "@/lib/auth-redirects";
import AuthTurnstile, { authTurnstileEnabled } from "@/components/AuthTurnstile";

// Sign-in for the host web app. Same Supabase Auth identity as the
// native app (§11) — this creates no separate web account model.
//
// TWO METHODS, and the order matters. Password is first because someone
// who made their account in the app already has one. Magic link is
// offered as a fallback rather than the default: it is genuinely useful
// on a shared or unfamiliar computer, but it fails silently when mail is
// slow, and defaulting to it makes signing in feel unreliable.
//
// Turnstile is enforced by Supabase Auth when configured. This form must
// send a fresh captcha token for both password and magic-link sign-in.
// The token is single-use, so failed attempts reset the widget.

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const destination = safeNext(next);

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

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(authTurnstileEnabled ? { options: { captchaToken } } : {}),
      });
      if (error) {
        setCaptchaResetKey((value) => value + 1);
        setMessage(error.message);
        setStatus("error");
        return;
      }
      router.refresh();
      router.push(destination);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(window.location.origin, destination),
        ...(authTurnstileEnabled ? { captchaToken } : {}),
      },
    });

    if (error) {
      setCaptchaResetKey((value) => value + 1);
      setMessage(error.message);
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
          We sent a sign-in link to{" "}
          <strong className="font-semibold text-forest">{email}</strong>. It
          works once, and it expires — if it has been a while, ask for
          another.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setCaptchaResetKey((value) => value + 1);
          }}
          className="mt-6 font-body text-sm font-semibold underline decoration-gold underline-offset-4 text-forest"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-sage/30 bg-offwhite p-8 shadow-soft"
    >
      <div className="flex gap-1 rounded-full border border-sage/30 p-1">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setStatus("idle");
              setMessage("");
            }}
            aria-pressed={mode === m}
            className={`flex-1 rounded-full px-4 py-2 font-body text-sm font-semibold transition-colors duration-400 ${
              mode === m
                ? "bg-forest text-offwhite"
                : "text-forest/70 hover:text-forest"
            }`}
          >
            {m === "password" ? "Password" : "Email me a link"}
          </button>
        ))}
      </div>

      <div className="mt-6">
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
        />
      </div>

      {mode === "password" && (
        <div className="mt-5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <label
              htmlFor="password"
              className="block font-body text-sm font-semibold text-forest"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="font-body text-sm underline decoration-gold underline-offset-4 text-forest/75 transition-colors duration-400 hover:text-forest"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-sage/40 bg-white px-4 py-2.5 font-body text-forest"
          />
        </div>
      )}

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
        {status === "submitting"
          ? "Just a moment…"
          : mode === "password"
            ? "Log in"
            : "Send me a link"}
      </button>

      <p className="mt-6 font-body text-sm leading-relaxed text-forest/70">
        New to Place &amp; Plenty?{" "}
        <Link
          href="/signup"
          className="font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4"
        >
          Create a free account
        </Link>{" "}
        — it takes a minute, and it&rsquo;s the same account you&rsquo;ll use
        in the app.
      </p>
    </form>
  );
}
