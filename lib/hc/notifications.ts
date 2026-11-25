// CREATOR NOTIFICATION TEMPLATES (application decision). Pure text. NO commission rates, payout amounts, tax or legal terms appear here (owner/counsel
// decisions); the approval message points to the creator portal where the current terms are shown. Sending is done by the email dispatcher
// (COMMS stream) and is OFF until it is wired and approved; these are only the words.
export type CreatorMessage = { subject: string; text: string };
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 80);
export const SUPPORT_NOTE = "Questions? Reply to this email or write to support@placeandplenty.com."; // replaced by the approved support@ wording once decided (see P2_FOOTER_SUPPORT_PROPOSAL)

export function applicationApprovedMessage(displayName: string, portalUrl: string): CreatorMessage {
  const n = clean(displayName) || "there";
  return {
    subject: "Welcome to the Place & Plenty Hosting Collective",
    text: [`Hi ${n},`, "", "Your Hosting Collective application has been approved. Sign in to your creator page to find your referral link and the current program details.", "", portalUrl, "", SUPPORT_NOTE].join("\n"),
  };
}

export function applicationDeclinedMessage(displayName: string, note?: string | null): CreatorMessage {
  const n = clean(displayName) || "there";
  const extra = note && note.trim() ? ["", `A note from our team: ${note.trim().slice(0, 500)}`] : [];
  return {
    subject: "About your Hosting Collective application",
    text: [`Hi ${n},`, "", "Thank you for applying to the Place & Plenty Hosting Collective. We are not able to offer you a place right now.", ...extra, "", SUPPORT_NOTE].join("\n"),
  };
}

// ---- lifecycle notices (WS-M). Transactional account messages only: no commission rates or amounts, no payout or legal terms, no invitation to
// any private group, and nothing that implies Facebook (or any social) membership creates program eligibility. Sending stays behind the dispatch flags.
export function applicationReceiptMessage(displayName: string): CreatorMessage {
  const n = clean(displayName) || "there";
  return {
    subject: "We received your Hosting Collective application",
    text: [`Hi ${n},`, "", "Thank you for applying to the Place & Plenty Hosting Collective. We have your application and will review it. There is nothing more you need to do right now.", "", SUPPORT_NOTE].join("\n"),
  };
}

export function memberLeftMessage(displayName: string, portalUrl: string): CreatorMessage {
  const n = clean(displayName) || "there";
  return {
    subject: "You have left the Hosting Collective",
    text: [`Hi ${n},`, "", "You have left the Place & Plenty Hosting Collective. Your Place & Plenty account and your gatherings are not affected.", "",
      "If you change your mind:", "- Collective Members and Contributors can rejoin from their creator page at any time.", "- Hosting Partners cannot rejoin on their own. A member of our team reviews every Hosting Partner request, and partner access is not restored automatically.", "", portalUrl, "", SUPPORT_NOTE].join("\n"),
  };
}

export function memberRejoinedMessage(displayName: string, portalUrl: string): CreatorMessage {
  const n = clean(displayName) || "there";
  return {
    subject: "Welcome back to the Hosting Collective",
    text: [`Hi ${n},`, "", "You are a member of the Place & Plenty Hosting Collective again. Your creator page shows your current membership details.", "", portalUrl, "", SUPPORT_NOTE].join("\n"),
  };
}

/** expiresOn: the real expiry timestamp (ISO) from the database. If it is missing or unreadable the text falls back to "about N days". */
export function applicationDraftExpiringMessage(portalUrl: string, expiresOn: string | null | undefined, fallbackDays = 7): CreatorMessage {
  const t = expiresOn ? Date.parse(expiresOn) : NaN;
  const when = Number.isFinite(t)
    ? `on ${new Date(t).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" })} (Eastern Time)`
    : `in about ${Number.isFinite(fallbackDays) ? Math.max(1, Math.min(30, Math.round(fallbackDays))) : 7} days`;
  return {
    subject: "Your saved Hosting Collective application is about to expire",
    text: ["Hi there,", "", `Your saved, unfinished Hosting Collective application will be removed ${when} if it is not submitted. Nothing has been sent to our team yet.`, "", `Finish and submit it here: ${portalUrl}`, "", SUPPORT_NOTE].join("\n"),
  };
}
