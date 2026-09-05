"use client";

import Script from "next/script";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const RETURN_PATHS: Record<string, string> = {
  "sign-up": "sign-up",
  "sign-in": "sign-in",
  "forgot-password": "forgot-password",
};

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

function MobileTurnstileContent() {
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow") ?? "sign-in";
  const returnPath = useMemo(() => RETURN_PATHS[flow] ?? RETURN_PATHS["sign-in"], [flow]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [message, setMessage] = useState("Checking this device…");

  const renderTurnstile = useCallback(() => {
    if (!SITE_KEY || !window.turnstile || !containerRef.current || widgetId.current) return;

    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      theme: "light",
      callback: (token) => {
        setMessage("Verified. Returning to Place & Plenty…");
        window.location.href = `placeandplenty://${returnPath}?captcha_token=${encodeURIComponent(token)}`;
      },
      "expired-callback": () => setMessage("That check expired. Please try again."),
      "error-callback": () => setMessage("We couldn't complete the security check. Please try again."),
    });
  }, [returnPath]);

  return (
    <main className="min-h-screen bg-[#F7F3EA] px-6 py-16 text-[#1E3A2E]">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderTurnstile}
      />
      <div className="mx-auto max-w-md rounded-2xl border border-[#A8B7A3]/40 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6F3D]">Place & Plenty</p>
        <h1 className="mt-3 text-2xl font-semibold">Quick security check</h1>
        <p className="mt-3 text-sm leading-6 text-[#1E3A2E]/70">
          This helps us keep automated signups and abusive login traffic out of your account experience.
        </p>
        {!SITE_KEY ? (
          <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Security check is not configured. Please return to the app and try again later.
          </p>
        ) : (
          <div className="mt-6 min-h-[70px]" ref={containerRef} />
        )}
        <p className="mt-4 text-sm text-[#1E3A2E]/65">{message}</p>
      </div>
    </main>
  );
}

export default function MobileTurnstilePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F7F3EA]" />}>
      <MobileTurnstileContent />
    </Suspense>
  );
}
