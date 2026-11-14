"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finishMultiDayGathering } from "@/lib/multi-day-actions";
import {
  CONFIRMING_PURCHASE_MESSAGE,
  PURCHASE_IN_APP_MESSAGE,
  type MultiDayPassStatus,
} from "@/lib/multi-day-pass";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";

export default function PassStepActions({
  gatheringId,
  status,
  priceLine,
  checkoutConfigured,
  justPaid,
  editHref,
}: {
  gatheringId: string;
  status: MultiDayPassStatus;
  priceLine: string;
  checkoutConfigured: boolean;
  justPaid: boolean;
  editHref: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const btn = "w-full rounded-lg bg-forest px-5 py-3 font-body text-sm font-semibold text-offwhite hover:bg-forest/90 disabled:opacity-60";

  function finish() {
    setError(null);
    start(async () => {
      const result = await finishMultiDayGathering(gatheringId);
      if (result.ok) {
        router.replace(`/host/g/${gatheringId}`);
        return;
      }
      setError(result.message);
      if (result.passRequired) router.refresh();
    });
  }

  if (status === "valid") {
    return (
      <div className="mt-6">
        <button type="button" onClick={finish} disabled={pending} className={btn}>
          {pending ? "Creating…" : "Finish creating gathering"}
        </button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {justPaid && (
        <p role="status" className="mb-4 rounded-lg bg-cream p-3 text-sm text-forest/80">
          {CONFIRMING_PURCHASE_MESSAGE}
        </p>
      )}
      {status !== "revoked" && (
        <p className="mb-4 font-body text-sm text-forest">Multi-Day Pass: <strong>{priceLine}</strong></p>
      )}
      {checkoutConfigured && status !== "revoked" ? (
        <form action="/api/checkout" method="post">
          <input type="hidden" name="product" value="multi-day" />
          <input type="hidden" name="gatheringId" value={gatheringId} />
          <button type="submit" className={btn}>Continue to payment</button>
        </form>
      ) : (
        <div className="rounded-lg border border-sage/30 p-4 text-sm text-forest/80">
          <p>{PURCHASE_IN_APP_MESSAGE}</p>
          <p className="mt-3 flex gap-4">
            {APP_STORE_URL && <a className="underline" href={APP_STORE_URL}>App Store</a>}
            {PLAY_STORE_URL && <a className="underline" href={PLAY_STORE_URL}>Google Play</a>}
          </p>
        </div>
      )}
      <button type="button" onClick={() => router.refresh()} className="mt-4 text-sm underline">
        I already have a pass — check again
      </button>
      <p className="mt-4 text-sm">
        <Link href={editHref} className="underline">Back to my draft</Link>
      </p>
    </div>
  );
}
