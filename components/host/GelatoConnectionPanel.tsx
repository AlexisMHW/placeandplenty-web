"use client";

import { useEffect, useState } from "react";

type Status =
  | { state: "loading" }
  | { state: "connected"; catalogs: Array<{ catalogUid: string; title: string }> }
  | { state: "error"; message: string };

export default function GelatoConnectionPanel() {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  useEffect(() => {
    let active = true;

    fetch("/api/paper-suite/gelato/status", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.connected) {
          throw new Error(body.error || "gelato_connection_failed");
        }
        return body as {
          connected: true;
          printableCatalogs?: Array<{ catalogUid: string; title: string }>;
        };
      })
      .then((body) => {
        if (!active) return;
        setStatus({
          state: "connected",
          catalogs: body.printableCatalogs || [],
        });
      })
      .catch((error) => {
        if (!active) return;
        setStatus({
          state: "error",
          message:
            error instanceof Error && error.message === "gelato_not_configured"
              ? "Gelato key is not configured for this deployment."
              : "Gelato could not be verified yet.",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-8 rounded-2xl border border-sage/25 bg-offwhite p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-forest/55">
            Print fulfillment
          </p>
          <h2 className="mt-2 font-display text-xl text-forest">Gelato connection</h2>
        </div>
        <span
          className={
            "rounded-full border px-3 py-1 font-body text-[0.62rem] font-bold uppercase tracking-[0.12em] " +
            (status.state === "connected"
              ? "border-sage/45 bg-cream text-forest"
              : status.state === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-sage/30 bg-parchment text-forest/60")
          }
        >
          {status.state === "connected"
            ? "Connected"
            : status.state === "error"
              ? "Needs attention"
              : "Checking"}
        </span>
      </div>

      {status.state === "loading" && (
        <p className="mt-3 font-body text-sm text-forest/60">
          Verifying the server-side API connection…
        </p>
      )}

      {status.state === "connected" && (
        <div className="mt-3">
          <p className="font-body text-sm leading-relaxed text-forest/70">
            The API key is staying server-side. Place & Plenty can now query Gelato products and request live print/shipping quotes without exposing the key to the browser.
          </p>
          {status.catalogs.length > 0 && (
            <p className="mt-2 font-body text-xs text-forest/55">
              Relevant catalogs found: {status.catalogs.map((catalog) => catalog.title).join(", ")}.
            </p>
          )}
        </div>
      )}

      {status.state === "error" && (
        <p className="mt-3 font-body text-sm leading-relaxed text-red-700">
          {status.message}
        </p>
      )}

      <p className="mt-4 border-t border-sage/20 pt-4 font-body text-xs leading-relaxed text-forest/55">
        Orders are not submitted to Gelato from this screen. We will only create a fulfillment order after a successful customer payment and a validated print file.
      </p>
    </section>
  );
}
