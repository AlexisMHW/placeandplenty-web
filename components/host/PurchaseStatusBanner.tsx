"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shown on /host/account after Stripe returns the customer (?purchase=success) or when the
// checkout route finds they already own it (?billing=already-owned). Access is granted by the
// payment webhook a few seconds after payment, so on success this re-reads the plan for up to
// ~30 seconds until the new access appears, and says plainly what is happening meanwhile.
export default function PurchaseStatusBanner({
  kind,
  hasPaidAccess,
}: {
  kind: "success" | "already-owned";
  hasPaidAccess: boolean;
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (kind !== "success" || hasPaidAccess || tries >= 10) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, 3000);
    return () => clearTimeout(t);
  }, [kind, hasPaidAccess, tries, router]);

  if (kind === "already-owned") {
    return (
      <div role="status" className="mt-6 rounded-lg border border-sage/40 bg-cream px-5 py-4">
        <p className="font-body text-sm leading-relaxed text-forest/80">
          You already have Plus on this account, so there was nothing to buy again. You have not been charged.
        </p>
      </div>
    );
  }

  if (hasPaidAccess) {
    return (
      <div role="status" className="mt-6 rounded-lg border border-gold/50 bg-cream px-5 py-4">
        <p className="font-display text-lg text-forest">Thank you — your purchase is confirmed.</p>
        <p className="mt-1 font-body text-sm leading-relaxed text-forest/75">
          It is on your account now, on the web and in the app. Your plan is shown below.
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="mt-6 rounded-lg border border-gold/50 bg-cream px-5 py-4">
      <p className="font-display text-lg text-forest">Payment received — finishing up.</p>
      <p className="mt-1 font-body text-sm leading-relaxed text-forest/75">
        {tries < 10
          ? "We are adding your purchase to your account. This usually takes a few seconds; this page will update by itself."
          : "This is taking longer than usual. Your payment went through. Refresh in a minute, and if your plan still has not changed, email support@placeandplenty.com and we will fix it right away."}
      </p>
    </div>
  );
}
