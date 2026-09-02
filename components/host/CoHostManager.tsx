"use client";

import { useState, useTransition } from "react";
import type { CoHostWorkspaceMember } from "@/lib/cohost-data";
import {
  inviteCoHost,
  reissueCoHostInvitation,
  removeCoHost,
} from "@/lib/host-actions";

const LABELS: Record<string, string> = {
  invited: "Invited — waiting for them to accept",
  accepted: "Sharing this gathering",
  declined: "Declined",
  removed: "No longer has access",
};

interface Issued {
  email: string;
  link: string;
}

export default function CoHostManager({
  gatheringId,
  members,
}: {
  gatheringId: string;
  members: CoHostWorkspaceMember[];
}) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = members.filter((m) => m.status !== "removed");
  const removed = members.filter((m) => m.status === "removed");
  const accepted = active.filter((m) => m.status === "accepted");

  function run(action: () => Promise<
    | { ok: true; value: Issued }
    | { ok: true }
    | { ok: false; message: string }
  >) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if ("value" in result) setIssued(result.value);
    });
  }

  return (
    <div>
      <p className="mt-6 font-body text-base text-forest/75">
        {accepted.length === 0
          ? active.length === 0
            ? "You’re running this one solo."
            : "No one has accepted yet."
          : `${accepted.length} ${accepted.length === 1 ? "person is" : "people are"} sharing this gathering with you.`}
      </p>

      <form
        className="mt-6 rounded-card border border-sage/30 bg-parchment p-5"
        action={(formData) => run(() => inviteCoHost(gatheringId, formData))}
      >
        <fieldset disabled={pending} className="contents">
          <label className="block">
            <span className="mb-1 block font-body text-sm font-semibold text-forest">
              Invite a co-host by email
            </span>
            <div className="flex flex-wrap gap-3">
              <input
                name="invited_email"
                type="email"
                required
                autoComplete="off"
                placeholder="them@example.com"
                className="min-w-0 flex-1 rounded-md border border-sage/40 bg-white px-3 py-2 font-body text-forest"
              />
              <button
                type="submit"
                className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90 disabled:opacity-60"
              >
                {pending ? "Working…" : "Create invitation"}
              </button>
            </div>
          </label>

          <p className="mt-2 font-body text-sm leading-relaxed text-forest/60">
            They&rsquo;ll need to accept while signed in with this exact address — an invitation can&rsquo;t be forwarded to someone else.
          </p>

          {error && (
            <p role="alert" className="mt-3 font-body text-sm text-error">{error}</p>
          )}
        </fieldset>
      </form>

      {issued && <InviteLink issued={issued} onDismiss={() => setIssued(null)} />}

      {active.length > 0 && (
        <ul className="mt-8 divide-y divide-sage/20">
          {active.map((m) => (
            <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-3.5">
              <div className="min-w-0">
                <p className="font-body text-base text-forest">{m.invited_email}</p>
                <p className="font-body text-sm text-forest/65">{LABELS[m.status] ?? m.status}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {m.status !== "accepted" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => reissueCoHostInvitation(gatheringId, m.invited_email))}
                    className="font-body text-sm text-forest/70 underline decoration-sage/50 underline-offset-4 transition-colors duration-400 hover:text-forest disabled:opacity-50"
                  >
                    Send a new link
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remove ${m.invited_email} from this gathering? They lose access straight away.`)) return;
                    run(() => removeCoHost(gatheringId, m.id));
                  }}
                  className="font-body text-sm text-forest/55 underline decoration-sage/50 underline-offset-4 transition-colors duration-400 hover:text-error disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {removed.length > 0 && (
        <p className="mt-6 font-body text-sm text-forest/55">
          {removed.length} {removed.length === 1 ? "person no longer has" : "people no longer have"} access to this gathering. Their contributions and messages are kept.
        </p>
      )}

      <p className="mt-8 font-body text-sm leading-relaxed text-forest/65">
        A co-host can help manage this gathering. They can&rsquo;t reach your private My Guest Book, your account-level Hosting Closet, or any other gathering of yours.
      </p>
    </div>
  );
}

function InviteLink({ issued, onDismiss }: { issued: Issued; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? issued.link : `${window.location.origin}${issued.link}`;

  return (
    <div className="mt-5 rounded-card border border-gold/50 bg-cream p-5">
      <p className="font-display text-lg text-forest">Send this to {issued.email}</p>
      <p className="mt-1 font-body text-sm leading-relaxed text-forest/70">
        Pass this link directly to them. It only works for {issued.email}, and it&rsquo;s shown once — if you lose it, create a new one.
      </p>
      <p className="mt-3 break-all rounded-md border border-sage/30 bg-offwhite px-3 py-2 font-body text-sm text-forest">{url}</p>
      <div className="mt-3 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false))}
          className="rounded-full border border-forest px-4 py-2 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={onDismiss} className="font-body text-sm text-forest/60 underline decoration-sage/50 underline-offset-4 hover:text-forest">
          Done
        </button>
      </div>
    </div>
  );
}
