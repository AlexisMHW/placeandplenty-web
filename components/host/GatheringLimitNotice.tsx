"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import {
  GATHERING_LIMIT_COPY,
  type GatheringLimitCode,
} from "@/lib/gathering-limits";

// WHEN A PLAN RULE ANSWERS, IT IS NOT AN ERROR MESSAGE.
// The database decides which state exists; this component only gives that
// state the correct Place & Plenty visual hierarchy.

export default function GatheringLimitNotice({
  code,
  onDismiss,
  className = "",
}: {
  code: GatheringLimitCode;
  onDismiss?: () => void;
  className?: string;
}) {
  const copy = GATHERING_LIMIT_COPY[code];
  if (!copy) return null;

  const isAnnual = code === "plus_annual_allowance_reached";
  const isPlus = code !== "free_open_gathering_limit_reached";
  const eyebrow = isPlus ? "PLACE & PLENTY PLUS" : "FREE";

  return (
    <section
      role="status"
      className={`rounded-card border bg-parchment p-5 md:p-6 ${
        isAnnual ? "border-gold" : "border-sage/45"
      } ${className}`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream ${
            isAnnual ? "text-goldInk" : "text-forest"
          }`}
        >
          <Icon name="leaf" size={19} />
        </span>

        <div className="min-w-0">
          <p
            className={`font-body text-[0.62rem] font-bold uppercase tracking-[0.2em] ${
              isAnnual ? "text-goldInk" : "text-forest/60"
            }`}
          >
            {eyebrow}
          </p>
          <h3 className="mt-1 font-display text-lg leading-snug text-forest">
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
