"use client";

import { useEffect } from "react";
import Link from "next/link";

// The runtime error boundary. §7 requires error states as a real V1
// experience rather than a placeholder.
//
// MUST be a client component with a `reset` prop — that is the contract
// Next's App Router expects, and `reset` re-renders the failed segment
// without a full page load. For a transient failure (a Supabase call
// that timed out, a flaky network on a guest's phone) that is genuinely
// the fix, so it is offered first.
//
// WHAT IT DELIBERATELY DOES NOT SHOW: the error message, the stack, or
// the digest. A guest opening an invitation on a phone cannot act on any
// of it, and an error string can carry internals — a Postgres message
// names tables and columns. The digest is logged for us, not displayed.
//
// This boundary does not catch errors in the root layout; that is what
// global-error.tsx is for. It also does not catch 404s — notFound()
// renders app/not-found.tsx instead.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The site has no analytics or crash SDK by design (§22 of the
    // master directive: adding one changes the privacy disclosures and
    // must be coordinated first). So this goes to the console and to
    // Vercel's function logs, which is what exists today.
    console.error("Unhandled error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-prose flex-col justify-center px-6 py-20">
      <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-forest/75">
        Something went wrong
      </p>

      <h1 className="mt-4 font-display text-3xl leading-tight text-forest md:text-4xl">
        That didn&rsquo;t load properly.
      </h1>

      <p className="mt-5 font-body text-lg leading-relaxed text-forest/80">
        This is on us, not on you. It&rsquo;s often temporary — trying again
        usually sorts it.
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full bg-forest px-7 py-3.5 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-forest px-7 py-3.5 font-body font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
        >
          Go to the homepage
        </Link>
      </div>

      <p className="mt-10 font-body text-base text-forest/70">
        If it keeps happening,{" "}
        <Link
          href="/support"
          className="underline decoration-gold underline-offset-4 hover:text-forest"
        >
          tell us
        </Link>{" "}
        and we&rsquo;ll look into it.
      </p>
    </div>
  );
}
