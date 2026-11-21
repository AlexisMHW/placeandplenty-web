import { NextResponse } from "next/server";
import { lookupShareInvite } from "@/lib/guest-api";
import {
  isShareToken,
  isTrustedArtworkUrl,
  PREVIEW_IMAGE_TYPES,
  PREVIEW_MAX_BYTES,
} from "@/lib/share-invite";
import { isClosedStatus } from "@/lib/invite-preview";

// Link-preview image for /i/[token]. Serves the host's invitation
// artwork through our own URL so the private storage link is never put
// in page metadata. Falls back to the branded image when there is no
// artwork, it is a PDF, or anything looks wrong. Contains nothing about
// guests or the address.
export const dynamic = "force-dynamic";

const FALLBACK = "/images/Place%20%26%20Plenty%20Logos%20(1).png";

function fallback(request: Request) {
  return NextResponse.redirect(new URL(FALLBACK, request.url), 302);
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  if (!isShareToken(params.token)) return fallback(request);
  const result = await lookupShareInvite(params.token);
  // Closed (completed / cancelled / archived) gatherings and unknown links get the branded image, never the host's artwork.
  const open = result.ok && !!result.data && !isClosedStatus(result.data.gatheringStatus, result.data.isArchived);
  const artwork = open && result.ok ? result.data?.artwork : null;
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
      },
    });
  } catch {
    return fallback(request);
  }
}
