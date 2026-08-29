"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase-browser";
import { callbackUrl, safeNext } from "@/lib/auth-redirects";

// WEB ACCOUNT CREATION. Founder requirement, 28 Aug 2026: a person must
// be able to create an account on the website and use Place & Plenty
// entirely on the web, without downloading anything.
//
// THE OBJECTION THIS REPLACES, and why it no longer holds. The login
// page used to say accounts could only be made in the app, because "a
// web sign-up would create profiles that have never seen onboarding, the
// entitlement setup or the profile trigger". That was checked against
// the live database rather than assumed, and it is not true:
//
//   - `on_auth_user_created` fires on auth.users for EVERY client, and
//     `handle_new_user` writes the canonical profile row. It reads
//     `first_name` / `last_name` out of raw_user_meta_data, which is why
//     this form collects a name and passes it in `options.data` — sign
//     up without them and the display name falls back to the part of the
//     email before the @, which is a worse first impression than asking.
//
//   - Free is the ABSENCE of an entitlement row, not the presence of
//     one. There is nothing to provision for a free account, on any
//     surface.
//
//   - Onboarding is an app experience. A web account gets the web
//     experience, which is the point of supporting web-only customers.
//
// So this creates the same canonical account the app creates. Not a web
// account. There is exactly one kind.
//
// EMAIL CONFIRMATION IS HANDLED BOTH WAYS. Supabase returns a session
// immediately when confirmations are off, and no session when they are
// on. Rather than assume the project's setting, this checks for a
// session: with one, it goes straight to the host app; without one, it
// says to check the inbox. That way turning confirmations on or off in
// the dashboard never breaks this form.
//
// PASSWORD RULES ARE THE SERVER'S. The minimum length is checked here
// only to fail fast and kindly; Supabase enforces the real policy,
// including leaked-password protection once it is enabled. Duplicating
// the ruleset in the client is how the two drift apart.

const MIN_PASSWORD = 8;

export default function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "check-inbox" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const destination = safeNext(next) || "/host";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < MIN_PASSWORD) {
      setMessage(`Please use at least ${MIN_PASSWORD} characters.`);
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
        // Read by handle_new_user to write the canonical profile row.
        data: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
        },
        emailRedirectTo: callbackUrl(window.location.origin, destination),
      },
    });

    if (error) {
      setMessage(error.message);
      setStatus("error");
      return;
    }

    if (data.session) {
      // Confirmations are off: they are signed in already.
      router.push(destination);
      router.refresh();
      return;
    }

    setStatus("check-inbox");
  }

  if (status === "check-inbox") {
    return (
      <div className="rounded-2xl border border-sage/30 bg-offwhite p-8 shadow-softer">
        <h2 className="font-display text-2xl text-forest">
          Check your email.
        </h2>
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
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-sage/30 bg-offwhite p-7 shadow-softer md:p-8"
    >
      <h2 className="font-display text-2xl text-forest">Create your account</h2>
      <p className="mt-2 font-body text-sm leading-relaxed text-forest/70">
        Free to start. One active gathering at a time, and everything you need
        to run it.
      </p>

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
  );
}
