"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

function checkoutProduct(pathname: string): string | undefined {
  const match = pathname.match(/^\/checkout\/([^/]+)$/);
  return match?.[1];
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRouteEvent = useRef<string | null>(null);

  useEffect(() => {
    const search = searchParams.toString();
    const routeKey = `${pathname}?${search}`;
    if (lastRouteEvent.current === routeKey) return;
    lastRouteEvent.current = routeKey;

    if (pathname === "/pricing") {
      track("pricing_viewed", { source: "web" });
    }

    if (pathname === "/host/create") {
      track("gathering_started", { source: "web" });
      sessionStorage.setItem("pp_gathering_creation_pending", String(Date.now()));
    }

    const product = checkoutProduct(pathname);
    if (product) {
      track("paywall_viewed", { source: "web", product });
    }

    if (pathname.startsWith("/host/g/")) {
      const pending = Number(sessionStorage.getItem("pp_gathering_creation_pending") || 0);
      if (pending && Date.now() - pending < 30 * 60 * 1000) {
        track("gathering_created", { source: "web" });
        sessionStorage.removeItem("pp_gathering_creation_pending");
      }
    }

    if (pathname === "/host/account" && searchParams.get("purchase") === "success") {
      track("purchase_completed", { source: "web" });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (pathname === "/signup") {
        track("signup_started", { source: "web" });
      }

      const action = form.getAttribute("action") || "";
      if (action === "/api/checkout") {
        const data = new FormData(form);
        track("checkout_started", {
          source: "web",
          product: String(data.get("product") || "unknown"),
        });
      }
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }

      if (url.hostname === "apps.apple.com") {
        track("app_store_click", { source: "web" });
      } else if (url.hostname === "play.google.com") {
        track("play_store_click", { source: "web" });
      }
    }

    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/signup") return;
    let captured = false;

    const observer = new MutationObserver(() => {
      if (captured) return;
      const text = document.body.textContent || "";
      if (text.includes("Check your email.")) {
        captured = true;
        track("account_created", {
          source: "web",
          email_confirmation_required: true,
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
