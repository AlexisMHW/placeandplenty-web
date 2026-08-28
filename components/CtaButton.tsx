"use client";

import Link from "next/link";
import { getCurrentCta } from "@/lib/launch-state";
import { track } from "@/lib/analytics";

interface CtaButtonProps {
  size?: "sm" | "lg";
  variant?: "primary" | "secondary";
  /** Invert for forest/photographic grounds — the hero and dark bands. */
  onDark?: boolean;
  /**
   * Seasonal override from Tina. Blank or absent keeps the launch-phase
   * default, so clearing the field is a safe way back rather than a way
   * to end up with an unlabelled button.
   */
  labelOverride?: string | null;
  className?: string;
}

export default function CtaButton({
  size = "lg",
  variant = "primary",
  onDark = false,
  labelOverride,
  className = "",
}: CtaButtonProps) {
  const cta = getCurrentCta();
  const base = variant === "secondary" ? cta.secondaryLabel : cta.primaryLabel;
  const href = variant === "secondary" ? cta.secondaryHref : cta.primaryHref;

  // Only the primary button honours the seasonal override. The secondary
  // is a fallback route ("Join the Guest List" behind "Become a Founding
  // Host") and relabelling it from a seasonal field would let the two
  // drift into saying the same thing.
  const label =
    variant === "primary" && labelOverride?.trim() ? labelOverride.trim() : base;

  if (!label || !href) return null;

  const sizeClasses =
    size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm";

  const variantClasses = onDark
    ? variant === "primary"
      ? "bg-offwhite text-forest hover:bg-cream"
      : "border border-offwhite/70 text-offwhite hover:bg-offwhite/10"
    : variant === "primary"
      ? "bg-forest text-offwhite hover:bg-forest/90"
      : "border border-forest text-forest hover:bg-forest/5";

  return (
    <Link
      href={href}
      onClick={() =>
        track(
          href.includes("founding-host")
            ? "founding_host_clicked"
            : "guest_list_signup_started"
        )
      }
      className={`inline-flex items-center justify-center rounded-full font-body font-semibold transition-colors duration-400 ${sizeClasses} ${variantClasses} ${className}`}
    >
      {label}
    </Link>
  );
}
