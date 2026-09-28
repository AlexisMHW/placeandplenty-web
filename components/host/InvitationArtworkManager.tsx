"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { getBrowserClient } from "@/lib/supabase-browser";
import { saveInvitationArtwork } from "@/lib/host-actions";
import {
  ARTWORK_ACCEPT_ATTRIBUTE,
  ARTWORK_LIMITS_HINT,
  artworkObjectPath,
  artworkRejectionReason,
  INVITATION_ARTWORK_BUCKET,
  isRenderableArtwork,
  resolveArtworkMimeType,
} from "@/lib/invitations";

function newFileId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // Fall through to a unique-enough browser id.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function InvitationArtworkManager({
  gatheringId,
  gatheringName,
  currentFilename,
  currentMimeType,
  currentArtworkUrl,
  readOnly = false,
}: {
  gatheringId: string;
  gatheringName: string;
  currentFilename?: string | null;
  currentMimeType?: string | null;
  currentArtworkUrl?: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState(currentFilename ?? null);
  const [mimeType, setMimeType] = useState(currentMimeType ?? null);
  const [artworkUrl, setArtworkUrl] = useState(currentArtworkUrl ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseArtwork(file: File | null | undefined) {
    if (!file || readOnly) return;

    setMessage(null);
    setError(null);

    const rejection = artworkRejectionReason(file);
    if (rejection) {
      setError(rejection);
      return;
    }

    const resolvedMime = resolveArtworkMimeType(file.type, file.name);
    if (!resolvedMime) {
      setError("That file type isn't supported. Use a PDF, JPG or PNG.");
      return;
    }

    setUploading(true);
    try {
      const supabase = getBrowserClient();
      const path = artworkObjectPath(gatheringId, file.name, newFileId());

      const { error: uploadError } = await supabase.storage
        .from(INVITATION_ARTWORK_BUCKET)
        .upload(path, file, {
          contentType: resolvedMime,
          upsert: false,
        });

      if (uploadError) {
        setError(
          uploadError.message?.toLowerCase().includes("row-level security")
            ? "This gathering is no longer editable, or your account does not have permission to change its invitation."
            : "That file didn't upload. Please try again."
        );
        return;
      }

      const saved = await saveInvitationArtwork(
        gatheringId,
        path,
        resolvedMime,
        file.name
      );

      if (!saved.ok) {
        setError(saved.message);
        return;
      }

      setFilename(file.name);
      setMimeType(resolvedMime);

      if (isRenderableArtwork(resolvedMime)) {
        const { data, error: signedError } = await supabase.storage
          .from(INVITATION_ARTWORK_BUCKET)
          .createSignedUrl(path, 3600);

        setArtworkUrl(signedError ? null : data?.signedUrl ?? null);
      } else {
        setArtworkUrl(null);
      }

      setMessage("Your artwork is now the invitation and gathering identity for this gathering.");
      router.refresh();
    } catch {
      setError("That file didn't upload. Please try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const isPdf = mimeType === "application/pdf";

  return (
    <section className="rounded-2xl border border-gold/30 bg-cream p-5 shadow-soft md:p-7">
      <p className="font-body text-[0.62rem] font-bold uppercase tracking-[0.18em] text-goldInk">
        Your own invitation
      </p>
      <h2 className="mt-2 font-display text-2xl text-forest">
        Bring over the invitation you already have
      </h2>
      <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-forest/70">
        Upload artwork from Canva, Etsy, a designer, or anywhere else. Place &amp; Plenty keeps the original invitation as the face of this gathering while RSVPs, contributions and the rest of the plan stay connected behind it.
      </p>

      {filename && (
        <div className="mt-6 grid gap-5 rounded-xl border border-sage/25 bg-offwhite p-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
          <div className="flex min-h-[9rem] items-center justify-center overflow-hidden rounded-lg border border-sage/25 bg-parchment">
            {artworkUrl && !isPdf ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artworkUrl}
                alt={`Invitation artwork for ${gatheringName}`}
                className="max-h-44 w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-forest/65">
                <Icon name="card" size={28} />
                <span className="font-body text-[0.65rem] font-bold uppercase tracking-[0.14em]">
                  {isPdf ? "PDF" : "Artwork"}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-body text-sm font-semibold text-forest">{filename}</p>
            <p className="mt-2 font-body text-sm leading-relaxed text-forest/65">
              This is currently the gathering's invitation artwork. Replacing it changes the gathering identity everywhere Place &amp; Plenty displays it.
            </p>
          </div>
        </div>
      )}

      {!readOnly ? (
        <>
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept={ARTWORK_ACCEPT_ATTRIBUTE}
            onChange={(event) => chooseArtwork(event.target.files?.[0])}
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="rounded-full bg-forest px-6 py-2.5 font-body text-sm font-semibold text-offwhite transition hover:bg-forest/90 disabled:opacity-60"
            >
              {uploading ? "Uploading…" : filename ? "Replace my artwork" : "Upload my artwork"}
            </button>
            <p className="font-body text-xs text-forest/60">{ARTWORK_LIMITS_HINT}</p>
          </div>
        </>
      ) : (
        <p className="mt-5 font-body text-sm font-semibold text-forest/65">
          This gathering is read-only, so its invitation artwork is preserved as-is.
        </p>
      )}

      {message && <p role="status" className="mt-4 font-body text-sm text-forest/75">{message}</p>}
      {error && <p role="alert" className="mt-4 font-body text-sm text-error">{error}</p>}
    </section>
  );
}
