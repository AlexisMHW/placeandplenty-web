"use server";

import { createClient } from "@/lib/supabase-server";

/**
 * Best-effort audit that the host opened a messaging/share hand-off for one
 * household. Calls the OPTIONAL RPC proposed in migration 208000; when the
 * backend does not have it (older schema) this resolves false and the
 * hand-off is unaffected. It never writes guests, parties or RSVP rows and
 * never claims a message was sent.
 */
export async function recordShareInitiatedWeb(
  gatheringId: string,
  invitationPartyId: string,
  channel: "sms_web" | "share_sheet" | "copy_link",
  locale: "en" | "es"
): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_invitation_share_initiated", {
      p_gathering_id: gatheringId,
      p_invitation_party_id: invitationPartyId,
      p_channel: channel,
      p_locale: locale,
    });
    return !error;
  } catch {
    return false;
  }
}
