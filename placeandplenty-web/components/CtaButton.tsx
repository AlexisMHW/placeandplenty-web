"use client";

import Link from "next/link";
import { getCurrentCta } from "@/lib/launch-state";
import { track } from "@/lib/analytics";

interface CtaButtonProps {
  size?: "sm" | "lg";
  variant?: "primary" | "secondary";
  className?: string;
}

export default function CtaButton({
  size = "lg",
  variant = "primary",
  className = "",
}: CtaButtonProps) {
  const cta = getCurrentCta();
  const label = variant === "secondary" ? cta.secondaryLabel : cta.primaryLabel;
  const href = variant === "secondary" ? cta.secondaryHref : cta.primaryHref;

  if (!label || !href) return null;

  const sizeClasses =
    size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2 text-sm";
  const variantClasses =
    variant === "primary"
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
