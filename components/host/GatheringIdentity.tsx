import Image from "next/image";
import { BotanicalCorner } from "@/components/Botanical";

// THE GATHERING'S FACE. §16 of the visual directive is the whole brief
// and it is emphatic:
//
//   "The gathering's invitation/artwork is the identity of the
//    gathering. Carry that artwork through: gathering header, hero
//    identity, gathering list, selected state, invitation management.
//    Do not replace the gathering identity with generic P&P
//    photography. P&P frames the gathering. The invitation identifies
//    it."
//
// So this component is the one place that decides what a gathering looks
// like, and every surface goes through it — the list rows, the upcoming
// hero, the workspace header. A host scanning their gatherings should
// recognise them the way they recognise them on their phone: by the
// invitation they chose.
//
// THE FALLBACK IS NOT GENERIC PHOTOGRAPHY, for the same reason. A
// gathering with no artwork yet gets a typographic plate built from its
// OWN name, on the house palette, with a botanical corner — so it still
// reads as that gathering rather than as a stock table someone else set.
// Dropping a warm hosting photograph in here would be exactly the
// substitution §16 forbids, and it would make two different gatherings
// look identical.
//
// PDF ARTWORK LANDS ON THE PLATE TOO. The bucket accepts PDFs, and a PDF
// cannot render in an <img>. signArtwork() filters them out rather than
// producing a broken image; the plate is what a host sees, and it is a
// real design rather than a failure state.

export default function GatheringIdentity({
  name,
  artworkUrl,
  className = "",
  sizes = "(min-width: 1024px) 20vw, 40vw",
  priority = false,
  overlay = false,
}: {
  name: string;
  /** A signed URL from signArtwork(). Absent is a normal state. */
  artworkUrl?: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Darken it, for cases where type is laid over the top. */
  overlay?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-forest ${className}`}>
      {artworkUrl ? (
        <Image
          src={artworkUrl}
          alt=""
          aria-hidden
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
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
            <p className="text-center font-display text-lg leading-tight text-offwhite/95 line-clamp-3">
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
