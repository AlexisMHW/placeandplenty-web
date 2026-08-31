"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import {
  GATHERING_LIMIT_COPY,
  type GatheringLimitCode,
} from "@/lib/gathering-limits";

// WHEN A PLAN RULE ANSWERS, IT IS NOT AN ERROR MESSAGE.
//
// A host on Free who already has a gathering open has not done anything
// wrong, and neither has a host on Plus with six. The database said no
// for a reason the host can act on, so this says what the reason is and
// where to go — in the same warm register as the rest of the workspace,
// not in the red reserved for "something broke".
//
// WHICH CARD IS SHOWN IS THE DATABASE'S DECISION, ARRIVING AS A CODE.
// Nothing here counts gatherings, reads an entitlement, or infers a
// tier: `code` comes straight from the trigger that refused the write.
// This is a renderer for the copy in lib/gathering-limits.ts and must
// stay one — the moment it starts deciding *whether* a host is at a
// limit, there are two answers to that question and they will disagree.
//
// The copy and the reasoning behind each call to action — including why
// the Plus 6 notice deliberately carries no Gathering Pass link — live
// beside the strings themselves, in lib/gathering-limits.ts.

export default function GatheringLimitNotice({
  code,
  onDismiss,
  className = "",
}: {
  code: GatheringLimitCode;
  /** Wired to the dismiss action where the copy offers one. */
  onDismiss?: () => void;
  className?: string;
}) {
  const copy = GATHERING_LIMIT_COPY[code];
  if (!copy) return null;

  return (
    // role="status", not "alert". The host is being told how their plan
    // works, and it is announced politely rather than interrupting.
    <section
      role="status"
      className={`rounded-card border border-gold/45 bg-parchment p-5 md:p-6 ${className}`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream text-forest"
        >
          <Icon name="leaf" size={19} />
        </span>

        <div className="min-w-0">
          <h3 className="font-display text-lg leading-snug text-forest">
            {copy.title}
          </h3>
          <p className="mt-1.5 max-w-prose font-body text-sm leading-relaxed text-forest/75">
            {copy.body}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              href={copy.primary.href}
              className="rounded-full bg-forest px-5 py-2.5 font-body text-sm font-semibold text-offwhite transition-colors duration-400 hover:bg-forest/90"
            >
              {copy.primary.label}
            </Link>

            {copy.secondary && (
              <Link
                href={copy.secondary.href}
                className="rounded-full border border-forest/35 px-5 py-2.5 font-body text-sm font-semibold text-forest transition-colors duration-400 hover:bg-forest/5"
              >
                {copy.secondary.label}
              </Link>
            )}

            {copy.dismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full px-4 py-2.5 font-body text-sm font-semibold text-forest/70 transition-colors duration-400 hover:text-forest"
              >
                {copy.dismiss}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
