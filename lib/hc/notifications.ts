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
