import { NextResponse } from "next/server";
import { lookupGuestPage } from "@/lib/guest-api";
import { isTrustedArtworkUrl, PREVIEW_IMAGE_TYPES, PREVIEW_MAX_BYTES } from "@/lib/share-invite";
import { isClosedStatus } from "@/lib/invite-preview";

// Link-preview image for /invite/[token] (one household's invitation link, used by the email and the text).
// Serves the host's invitation artwork through our own URL so the signed storage link is never put in page metadata. Falls back to the
// branded image when there is no uploaded artwork, it is a PDF, the gathering is completed / cancelled / archived, the link is unknown,
// or anything looks wrong. Contains nothing about the household, the address or the time.
export const dynamic = "force-dynamic";

const FALLBACK = "/images/Place%20%26%20Plenty%20Logos%20(1).png";

function fallback(request: Request) {
  return NextResponse.redirect(new URL(FALLBACK, request.url), 302);
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const result = await lookupGuestPage(params.token);
  const data = result.ok ? result.data : null;
  if (!data || isClosedStatus(data.gatheringStatus, data.isArchived)) return fallback(request);
  const artwork = data.invitationMode === "uploaded" ? data.invitationArtwork : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!artwork || !isTrustedArtworkUrl(artwork.url, supabaseUrl)) return fallback(request);
  if (!(PREVIEW_IMAGE_TYPES as readonly string[]).includes(artwork.mimeType)) return fallback(request);

  try {
    const upstream = await fetch(artwork.url, { cache: "no-store" });
    const type = upstream.headers.get("content-type")?.split(";")[0] ?? "";
    if (!upstream.ok || !(PREVIEW_IMAGE_TYPES as readonly string[]).includes(type)) return fallback(request);
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > PREVIEW_MAX_BYTES) return fallback(request);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        // Short cache: if the host changes the artwork the preview follows soon.
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return fallback(request);
  }
}
