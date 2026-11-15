"use client";

import { useState } from "react";
import {
  buildInvitationUrl,
  buildInviteMessage,
  buildSmsUri,
  detectWebPlatform,
  pickPartyPhone,
  type ShareLocale,
} from "@/lib/share-by-text";
import { SHARE_BY_TEXT_COPY } from "@/lib/share-by-text-copy";
import { recordShareInitiatedWeb } from "@/lib/share-by-text-actions";

interface Props {
  gatheringId: string;
  partyId: string;
  /** invitation_parties.public_token: the household's existing private link. */
  token: string | null | undefined;
  phones: Array<string | null | undefined>;
  guestFirstName?: string | null;
  hostName?: string | null;
  gatheringName: string;
  gatheringDate?: string | null;
  arrivalTime?: string | null;
  /** Origin + /invite for this deployment; omitted = the production guest page (legacy); null = no base is configured for this (non-production) environment, so no link is built (follow-up J). */
  baseUrl?: string | null;
  locale?: ShareLocale;
}

/**
 * Hands a prepared invitation to the host's own messaging app (phones) or
 * copies it (computers). Never sends, never claims it was delivered.
 */
export default function ShareByTextButton(props: Props) {
  const locale: ShareLocale = props.locale ?? "en";
  const copy = SHARE_BY_TEXT_COPY[locale];
  const [notice, setNotice] = useState<string | null>(null);

  const url = buildInvitationUrl(props.token, props.baseUrl);
  const phone = pickPartyPhone(props.phones);
  const body = url
    ? buildInviteMessage({
        locale,
        url,
        gatheringName: props.gatheringName,
        hostName: props.hostName,
        guestFirstName: props.guestFirstName,
        gatheringDate: props.gatheringDate,
        arrivalTime: props.arrivalTime,
      })
    : null;

  async function copyText() {
    if (!body) return setNotice(copy.noLink);
    try {
      await navigator.clipboard.writeText(body);
      setNotice(copy.copied);
      void recordShareInitiatedWeb(props.gatheringId, props.partyId, "copy_link", locale);
    } catch {
      setNotice(copy.copyFailed);
    }
  }

  function openMessages() {
    if (!body) return setNotice(copy.noLink);
    const platform = detectWebPlatform(navigator.userAgent, navigator.maxTouchPoints);
    if (platform === "web") {
      // A desktop browser has no SMS app to hand off to. Copy instead of a dead link.
      setNotice(copy.desktopHint);
      void copyText();
      return;
    }
    window.location.href = buildSmsUri({ platform, phone, body });
    setNotice(phone ? copy.opened : copy.openedNoPhone);
    void recordShareInitiatedWeb(props.gatheringId, props.partyId, "sms_web", locale);
  }

  async function shareSheet() {
    if (!body || !navigator.share) return copyText();
    try {
      await navigator.share({ text: body });
      void recordShareInitiatedWeb(props.gatheringId, props.partyId, "share_sheet", locale);
    } catch {
      /* dismissed by the host: nothing happened */
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={openMessages}
        disabled={!body}
        aria-label={copy.a11yText(props.guestFirstName ?? "")}
        className="rounded-full border border-forest px-4 py-2 font-body text-xs font-semibold text-forest disabled:opacity-50"
      >
        {copy.textButton}
      </button>
      <button
        type="button"
        onClick={copyText}
        disabled={!body}
        className="rounded-full border border-sage/50 px-4 py-2 font-body text-xs font-semibold text-forest/80 disabled:opacity-50"
      >
        {copy.copyButton}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={shareSheet}
          disabled={!body}
          className="rounded-full border border-sage/50 px-4 py-2 font-body text-xs font-semibold text-forest/80 disabled:opacity-50"
        >
          {copy.shareButton}
        </button>
      )}
      {!phone && body && <p className="w-full font-body text-xs italic text-forest/55">{copy.noPhoneHint}</p>}
      {notice && (
        <p role="status" className="w-full font-body text-xs text-forest/75">
          {notice}
        </p>
      )}
    </div>
  );
}
