"use client";

import Script from "next/script";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, safeNext } from "@/lib/auth-redirects";

// WEB ACCOUNT CREATION. Founder requirement, 28 Aug 2026: a person must
// be able to create an account on the website and use Place & Plenty
// entirely on the web, without downloading anything.
//
// This form creates the same canonical Supabase account as native. Bot
// protection is layered rather than delegated to a single browser check:
//
//   - a honeypot quietly drops basic form-filling bots;
//   - when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured, Cloudflare
//     Turnstile supplies a token to Supabase Auth;
//   - Supabase Auth remains the authority for password policy, CAPTCHA
//     verification, email confirmation, and account creation.
//
// IMPORTANT: Turnstile is fully enforced only after CAPTCHA protection is
// enabled in Supabase Auth with the matching Turnstile secret key. Keeping
// enforcement at Supabase means a bot cannot bypass this page and call the
// public Auth signup endpoint directly.

const MIN_PASSWORD = 8;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export default function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "check-inbox" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const destination = safeNext(next) || "/host";
  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

  const renderTurnstile = useCallback(() => {
    if (
      !captchaEnabled ||
      !window.turnstile ||
      !turnstileContainerRef.current ||
      turnstileWidgetId.current
    ) {
      return;
    }

    turnstileWidgetId.current = window.turnstile.render(
      turnstileContainerRef.current,
      {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      },
    );
  }, [captchaEnabled]);

  function resetCaptcha() {
    setCaptchaToken("");
    if (turnstileWidgetId.current) {
      window.turnstile?.reset(turnstileWidgetId.current);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Hidden from real users. Bots that blindly fill every field are given
    // a success-shaped response without creating an account.
    if (companyWebsite.trim()) {
      setStatus("check-inbox");
      return;
    }

    if (password.length < MIN_PASSWORD) {
      setMessage(`Please use at least ${MIN_PASSWORD} characters.`);
      setStatus("error");
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setMessage("Please complete the quick security check and try again.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setMessage("");

    const supabase = getBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
        emailRedirectTo: callbackUrl(window.location.origin, destination),
        ...(captchaEnabled ? { captchaToken } : {}),
      },
    });

    if (error) {
      resetCaptcha();
      setMessage(error.message);
      setStatus("error");
      return;
    }

    if (data.session) {
      router.push(destination);
      router.refresh();
      return;
    }

    setStatus("check-inbox");
  }

  if (status === "check-inbox") {
    return (
      <div className="rounded-2xl border border-sage/30 bg-offwhite p-8 shadow-softer">
        <h2 className="font-display text-2xl text-forest">Check your email.</h2>
        <p className="mt-3 font-body text-base leading-relaxed text-forest/80">
          We’ve sent a confirmation link to{" "}
          <strong className="font-semibold text-forest">{email}</strong>. Open
          it and you’ll land straight in your account.
        </p>
        <p className="mt-4 font-body text-sm leading-relaxed text-forest/65">
          Nothing there after a minute or two? Check the spam folder — and if
          it still hasn’t arrived,{" "}
          <Link
            href="/support"
            className="underline decoration-gold underline-offset-4"
          >
            let us know
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      {captchaEnabled && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={renderTurnstile}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="relative rounded-2xl border border-sage/30 bg-offwhite p-7 shadow-softer md:p-8"
      >
        <h2 className="font-display text-2xl text-forest">Create your account</h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
          Free to start. One active gathering at a time, and everything you need
          to run it.
        </p>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="signup-company-website">Company website</label>
          <input
            id="signup-company-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="signup-first"
              className="block font-body text-sm font-semibold text-forest"
            >
              First name
            </label>
            <input
              id="signup-first"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-sage/40 bg-parchment px-3.5 py-2.5 font-body text-base text-forest"
            />
          </div>
          <div>
            <label
              htmlFor="signup-last"
              className="block font-body text-sm font-semibold text-forest"
            >
              Last name
            </label>
            <input
              id="signup-last"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-sage/40 bg-parchment px-3.5 py-2.5 font-body text-base text-forest"
            />
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="signup-email"
            className="block font-body text-sm font-semibold text-forest"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-sage/40 bg-parchment px-3.5 py-2.5 font-body text-base text-forest"
          />
        </div>

        <div className="mt-4">
          <label
            htmlFor="signup-password"
            className="block font-body text-sm font-semibold text-forest"
          >
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="signup-password-hint"
            className="mt-1.5 w-full rounded-lg border border-sage/40 bg-parchment px-3.5 py-2.5 font-body text-base text-forest"
          />
          <p
            id="signup-password-hint"
            className="mt-1.5 font-body text-xs text-forest/60"
          >
            At least {MIN_PASSWORD} characters.
          </p>
        </div>

        {captchaEnabled && (
          <div className="mt-5 min-h-[65px]" aria-label="Security check">
            <div ref={turnstileContainerRef} />
          </div>
        )}

        {status === "error" && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-error/10 px-4 py-3 font-body text-sm text-error"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-6 w-full rounded-lg bg-forest px-5 py-3 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
        >
          {status === "submitting" ? "Creating your account…" : "Start Free"}
        </button>

        <p className="mt-4 font-body text-xs leading-relaxed text-forest/60">
          By creating an account you agree to our{" "}
          <Link
            href="/terms"
            className="underline decoration-gold underline-offset-4"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline decoration-gold underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p className="mt-5 border-t border-sage/25 pt-5 font-body text-sm text-forest/75">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </form>
    </>
  );
}
