"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type State =
  | { kind: "idle" }
  | { kind: "working"; message: string }
  | { kind: "success"; message: string }
  | { kind: "cancelled"; message: string }
  | { kind: "error"; message: string };

export default function PaperSuitePurchaseStatus() {
  const params = useSearchParams();
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    const purchase = params.get("paper_order");
    if (!purchase) return;

    if (purchase === "cancelled") {
      setState({
        kind: "cancelled",
        message: "Checkout was cancelled. Nothing was sent to print.",
      });
      return;
    }

    if (purchase !== "success") return;

    const orderId = params.get("order_id");
    const sessionId = params.get("session_id");
    if (!orderId || !sessionId) {
      setState({
        kind: "error",
        message: "Payment returned without the order references needed to continue.",
      });
      return;
    }

    let cancelled = false;
    let attempt = 0;

    async function fulfill() {
      attempt += 1;
      setState({
        kind: "working",
        message:
          attempt === 1
            ? "Payment received. Preparing your print order…"
            : "Payment is confirmed. Waiting for the order record to finish syncing…",
      });

      try {
        const response = await fetch("/api/paper-suite/fulfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ orderId, sessionId }),
        });
        const body = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.ok && body.fulfilled) {
          setState({
            kind: "success",
            message: body.draft
              ? "Sandbox payment verified. Gelato created a draft order only — nothing has been sent to production."
              : "Payment verified and your Paper Suite order has been sent to Gelato for fulfillment.",
          });
          return;
        }

        if (
          (body.error === "payment_processing" || body.error === "payment_not_verified") &&
          attempt < 5
        ) {
          window.setTimeout(fulfill, 1800);
          return;
        }

        if (body.error === "live_fulfillment_not_enabled") {
          setState({
            kind: "success",
            message:
              "Payment is verified. Live Gelato fulfillment is still intentionally disabled, so nothing has been sent to print yet.",
          });
          return;
        }

        setState({
          kind: "error",
          message:
            "Your payment is safe, but the print handoff needs attention. The order has not been sent twice.",
        });
      } catch {
        if (!cancelled) {
          setState({
            kind: "error",
            message:
              "Your payment returned successfully, but the print handoff could not be verified yet.",
          });
        }
      }
    }

    fulfill();

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (state.kind === "idle") return null;

  const classes =
    state.kind === "success"
      ? "border-sage/45 bg-cream text-forest"
      : state.kind === "cancelled"
        ? "border-gold/30 bg-parchment text-forest"
        : state.kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-sage/30 bg-offwhite text-forest";

  return (
    <section className={"mt-6 rounded-2xl border px-5 py-4 " + classes}>
      <p className="font-body text-sm font-semibold">
        {state.kind === "working"
          ? "Paper Suite order"
          : state.kind === "success"
            ? "Paper Suite order confirmed"
            : state.kind === "cancelled"
              ? "Checkout cancelled"
              : "Paper Suite order needs attention"}
      </p>
      <p className="mt-1 font-body text-sm leading-relaxed opacity-75">{state.message}</p>
    </section>
  );
}
