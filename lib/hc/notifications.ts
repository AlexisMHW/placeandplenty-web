// CREATOR NOTIFICATION TEMPLATES (application decision). Pure text. NO commission rates, payout amounts, tax or legal terms appear here (owner/counsel
// decisions); the approval message points to the creator portal where the current terms are shown. Sending is done by the email dispatcher
// (COMMS stream) and is OFF until it is wired and approved; these are only the words.
export type CreatorMessage = { subject: string; text: string };
const clean = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 80);
export const SUPPORT_NOTE = "Reply to this email if you have a question."; // replaced by the approved support@ wording once decided (see P2_FOOTER_SUPPORT_PROPOSAL)

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
    text: [`Hi ${n},`, "", "You have left the Place & Plenty Hosting Collective. Your Place & Plenty account and your gatherings are not affected.", "", `If you change your mind, you can rejoin from your creator page, or we may need to review the request first: ${portalUrl}`, "", SUPPORT_NOTE].join("\n"),
  };
}

export function memberRejoinedMessage(displayName: string, portalUrl: string): CreatorMessage {
  const n = clean(displayName) || "there";
  return {
    subject: "Welcome back to the Hosting Collective",
    text: [`Hi ${n},`, "", "You are a member of the Place & Plenty Hosting Collective again. Your creator page shows your current membership details.", "", portalUrl, "", SUPPORT_NOTE].join("\n"),
  };
}

export function applicationDraftExpiringMessage(portalUrl: string, daysLeft: number): CreatorMessage {
  const d = Number.isFinite(daysLeft) ? Math.max(1, Math.min(30, Math.round(daysLeft))) : 7;
  return {
    subject: "Your saved Hosting Collective application is about to expire",
    text: ["Hi there,", "", `Your saved, unfinished Hosting Collective application will be removed in about ${d} days if it is not submitted. Nothing has been sent to our team yet.`, "", `Finish and submit it here: ${portalUrl}`, "", SUPPORT_NOTE].join("\n"),
  };
}
