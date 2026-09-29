"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase-browser";

export default function PaperOrderStatusSyncButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.functions.invoke("sync-paper-order-status", {
        body: { orderId },
      });
      if (error) throw error;
      setMessage("Updated");
      router.refresh();
    } catch {
      setMessage("Couldn’t refresh");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="font-body text-[0.68rem] font-semibold text-forest underline decoration-gold decoration-2 underline-offset-4 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Refresh status"}
      </button>
      {message ? (
        <span role="status" className="font-body text-[0.65rem] text-forest/50">
          {message}
        </span>
      ) : null}
    </span>
  );
}
