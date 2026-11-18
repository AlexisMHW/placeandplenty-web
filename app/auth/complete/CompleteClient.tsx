"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";
import { CONFIRMED_PATH, RESET_PASSWORD_PATH, parseAuthFragment, safeNext } from "@/lib/auth-redirects";

export default function CompleteClient({ next, recovery }: { next?: string; recovery: boolean }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const destination = safeNext(next);
    const fail = (reason: string) => {
      // Same failure screens as the server callback, so a dead link always ends somewhere that explains it and offers a way forward.
      const url = recovery || destination.startsWith(RESET_PASSWORD_PATH)
        ? `${RESET_PASSWORD_PATH}?error=${reason}`
        : `/login?error=${reason}&next=${encodeURIComponent(destination)}`;
      router.replace(url);
    };
    (async () => {
      const result = parseAuthFragment(window.location.hash);
      if (result.kind === "error") return fail(result.reason);
      if (result.kind === "none") return fail("missing_code");
      const { error } = await getBrowserClient().auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
      if (cancelled) return;
      if (error) return fail("link_expired");
      // Remove the credentials from the address bar and history before moving on.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.refresh();
      router.replace(recovery || result.type === "recovery" ? RESET_PASSWORD_PATH : destination);
    })().catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [next, recovery, router]);

  return (
    <main className="mx-auto max-w-prose px-6 py-24 text-center">
      {failed ? (
        <>
          <p className="font-display text-2xl text-forest">We couldn&rsquo;t finish that link.</p>
          <p className="mt-3 font-body text-forest/70">
            Please <a className="underline decoration-gold underline-offset-4" href="/login">sign in</a> and ask for a new one.
          </p>
        </>
      ) : (
        <p className="font-body text-forest/70" role="status">One moment&hellip;</p>
      )}
    </main>
  );
}
