"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptCoHostInvitation,
  declineCoHostInvitation,
} from "@/lib/host-actions";

// Accept or decline, and then go somewhere useful.
//
// ON SUCCESS THE ROUTER PUSHES STRAIGHT INTO THE GATHERING. The RPC
// returns the gathering id it just granted access to, so there is no
// "now go and find it in your list" step — the thing you accepted is the
// thing you are looking at a second later.
//
// DECLINING IS OFFERED AND IS NOT A DEAD END. decline_gathering_invitation()
// sets status = 'declined', which the host sees on their co-hosts page.
// Silently ignoring an invitation leaves them waiting; saying no is
// kinder and is one press.

export default function CoHostInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<
    { kind: "error" | "done"; text: string } | null
  >(null);

  if (message?.kind === "done") {
    return (
      <p role="status" className="mt-8 font-body text-base text-forest">
        {message.text}
      </p>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await acceptCoHostInvitation(token);
              if (!result.ok) {
                setMessage({ kind: "error", text: result.message });
                return;
              }
              router.push(`/host/g/${result.value.gatheringId}`);
            });
          }}
          className="rounded-full bg-forest px-7 py-3 font-body font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
        >
          {pending ? "Working…" : "Accept and co-host"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await declineCoHostInvitation(token);
              setMessage(
                result.ok
                  ? {
                      kind: "done",
                      text: "You’ve declined. We’ve let the host know.",
                    }
                  : { kind: "error", text: result.message }
              );
            });
          }}
          className="rounded-full px-5 py-3 font-body text-forest/70 transition-colors duration-400 hover:text-forest disabled:opacity-60"
        >
          No thanks
        </button>
      </div>

      {message?.kind === "error" && (
        <p role="alert" className="mt-5 font-body text-sm text-error">
          {message.text}
        </p>
      )}
    </div>
  );
}
