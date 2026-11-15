"use client";

import { useMemo, useState } from "react";
import {
  buildInviteMessage, buildSmsUri, detectWebPlatform, planShareQueue, type ShareLocale,
} from "@/lib/share-by-text";
import { back, createWalk, currentItem, isDone, markOpened, skip, summarize, type WalkState } from "@/lib/share-step-through";
import { STEP_THROUGH_COPY } from "@/lib/share-step-through-copy";
import { recordShareInitiatedWeb } from "@/lib/share-by-text-actions";

export interface StepHousehold {
  partyId: string;
  token: string | null | undefined;
  phones: Array<string | null | undefined>;
  leadFirstName?: string | null;
  displayName: string;
}

interface Props {
  gatheringId: string;
  gatheringName: string;
  gatheringDate?: string | null;
  arrivalTime?: string | null;
  hostName?: string | null;
  baseUrl?: string | null;
  households: StepHousehold[];
  locale?: ShareLocale;
}

/**
 * Bulk "text every household, one at a time". One composer per household with that household's own private link,
 * with Skip and Back. On phones it opens the messaging app; on computers it copies the text. It never sends anything
 * and never says it did.
 */
export default function ShareStepThrough(props: Props) {
  const locale: ShareLocale = props.locale ?? "en";
  const copy = STEP_THROUGH_COPY[locale];
  const plan = useMemo(
    () => planShareQueue(props.households.map((h) => ({ partyId: h.partyId, token: h.token, phones: h.phones })), props.baseUrl),
    [props.households, props.baseUrl]
  );
  const [open, setOpen] = useState(false);
  const [walk, setWalk] = useState<WalkState>(() => createWalk(plan.queue));
  const [notice, setNotice] = useState<string | null>(null);

  const item = currentItem(walk);
  const household = item ? props.households.find((h) => h.partyId === item.partyId) : undefined;
  const body = item && household
    ? buildInviteMessage({
        locale, url: item.url, gatheringName: props.gatheringName, hostName: props.hostName,
        guestFirstName: household.leadFirstName, gatheringDate: props.gatheringDate, arrivalTime: props.arrivalTime,
      })
    : null;
  const summary = summarize(walk);

  async function handoff() {
    if (!item || !body) return;
    const platform = detectWebPlatform(navigator.userAgent, navigator.maxTouchPoints);
    if (platform === "web") {
      try {
        await navigator.clipboard.writeText(body);
        void recordShareInitiatedWeb(props.gatheringId, item.partyId, "copy_link", locale);
        setNotice(null);
        setWalk((w) => markOpened(w));
      } catch {
        setNotice(copy.desktopHint);
      }
      return;
    }
    window.location.href = buildSmsUri({ platform, phone: item.phone, body });
    void recordShareInitiatedWeb(props.gatheringId, item.partyId, "sms_web", locale);
    setNotice(null);
    setWalk((w) => markOpened(w));
  }

  if (props.households.length < 2) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-6 rounded-full border border-forest px-4 py-2 font-body text-xs font-semibold text-forest">
        {copy.entry}
      </button>
    );
  }
  return (
    <section aria-label={copy.title} className="mt-6 rounded-card border border-sage/25 bg-parchment p-5">
      <h3 className="font-display text-lg text-forest">{copy.title}</h3>
      <p className="mt-1 font-body text-xs text-forest/65">{copy.explainer}</p>
      {plan.skipped.length > 0 && <p className="mt-2 font-body text-xs italic text-forest/60">{copy.noLinkNote(plan.skipped.length)}</p>}
      {!isDone(walk) && item && household ? (
        <div className="mt-4 space-y-2">
          <p className="font-body text-xs text-forest/60">{copy.progress(walk.index + 1, summary.total)}</p>
          <p className="font-body text-sm font-semibold text-forest">{household.displayName}</p>
          {body && <p className="whitespace-pre-wrap font-body text-sm text-forest/80">{body}</p>}
          {!item.phone && <p className="font-body text-xs italic text-forest/55">{copy.noPhoneHint}</p>}
          {notice && <p role="status" className="font-body text-xs text-forest/75">{notice}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" onClick={handoff} className="rounded-full bg-forest px-4 py-2 font-body text-xs font-semibold text-parchment">
              {typeof navigator !== "undefined" && detectWebPlatform(navigator.userAgent, navigator.maxTouchPoints) === "web" ? copy.copyAndNext : copy.openMessages}
            </button>
            <button type="button" onClick={() => setWalk((w) => back(w))} disabled={walk.index === 0} className="font-body text-xs font-semibold text-forest disabled:opacity-40">{copy.back}</button>
            <button type="button" onClick={() => { setNotice(null); setWalk((w) => skip(w)); }} className="font-body text-xs font-semibold text-forest">{copy.skip}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-1">
          <p className="font-body text-sm font-semibold text-forest">{copy.doneTitle}</p>
          <p className="font-body text-sm text-forest/80">{copy.doneBody(summary.opened, summary.skipped)}</p>
          <p className="font-body text-xs italic text-forest/60">{copy.doneHonest}</p>
        </div>
      )}
      <button type="button" onClick={() => setOpen(false)} className="mt-4 font-body text-xs font-semibold text-forest/70">{copy.close}</button>
    </section>
  );
}
