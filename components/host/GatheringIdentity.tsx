import Image from "next/image";
import { BotanicalCorner } from "@/components/Botanical";

// The gathering's invitation/artwork is its identity everywhere in P&P.
// `fit="contain"` is reserved for larger editorial identity panels where
// the whole invitation should remain visible; compact list tiles keep the
// normal cover treatment.
export default function GatheringIdentity({
  name,
  artworkUrl,
  className = "",
  sizes = "(min-width: 1024px) 20vw, 40vw",
  priority = false,
  overlay = false,
  fit = "cover",
}: {
  name: string;
  artworkUrl?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  overlay?: boolean;
  fit?: "cover" | "contain";
}) {
  return (
    <div
      className={`relative overflow-hidden ${
        fit === "contain" ? "bg-offwhite" : "bg-forest"
      } ${className}`}
    >
      {artworkUrl ? (
        <Image
          src={artworkUrl}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          priority={priority}
          className={fit === "contain" ? "object-contain" : "object-cover"}
          // Signed URLs are per-request and short-lived, so Next's image
          // optimiser would cache a URL that stops working before the
          // cache entry does.
          unoptimized
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-forest via-forest to-sage"
          />
          <BotanicalCorner
            className="-right-4 -top-4 text-offwhite"
            size={110}
          />
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="line-clamp-3 text-center font-display text-lg leading-tight text-offwhite/95">
              {name}
            </p>
          </div>
        </>
      )}

      {overlay && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-forest/85 via-forest/55 to-forest/10"
        />
      )}
    </div>
  );
}
