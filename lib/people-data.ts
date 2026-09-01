import { createClient } from "@/lib/supabase-server";

export interface PeopleWorkspaceRow {
  id: string;
  rsvp_status: string;
  plus_one_count: number;
  notes: string | null;
  guest_dietary_notes: string | null;
  guest_allergy_notes: string | null;
  invitation_party_id: string | null;
  guest: {
    id: string;
    first_name: string;
    last_name: string | null;
    household_name: string | null;
    email: string | null;
    phone: string | null;
    dietary_notes: string | null;
    allergy_notes: string | null;
    accessibility_notes: string | null;
  } | null;
  party: {
    id: string;
    party_name: string | null;
    contact_email: string | null;
    first_share_initiated_at: string | null;
  } | null;
  latest_invitation_delivery_status: string | null;
}

/**
 * One My People read for the web workspace.
 *
 * Guest identity/contact fields live on `guests`; this gathering's RSVP,
 * host note and plus-one count live on `gathering_guests`; invitation
 * recipient details live on `invitation_parties`. We read all three rather
 * than flattening them into a web-only guest shape, so edits from either
 * surface show up here without reconciliation.
 */
export async function getPeopleWorkspace(gatheringId: string): Promise<PeopleWorkspaceRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_guests")
    .select(
      "id, rsvp_status, plus_one_count, notes, guest_dietary_notes, guest_allergy_notes, invitation_party_id, guest:guests(id, first_name, last_name, household_name, email, phone, dietary_notes, allergy_notes, accessibility_notes), party:invitation_parties(id, party_name, contact_email, first_share_initiated_at)"
    )
    .eq("gathering_id", gatheringId);
  if (error) throw error;

  const rows = (data ?? []) as unknown as Omit<PeopleWorkspaceRow, "latest_invitation_delivery_status">[];

  // Invitation state is party-level. Read the same delivery rows native uses
  // and keep only the newest status for each party. `first_share_initiated_at`
  // remains the canonical "an invite was initiated" marker; a missing delivery
  // row is therefore shown as Queued, never fabricated as Sent.
  const { data: deliveries, error: deliveryError } = await supabase
    .from("communication_deliveries")
    .select(
      "invitation_party_id, status, created_at, communication_events!inner(gathering_id, type)"
    )
    .eq("communication_events.gathering_id", gatheringId)
    .eq("communication_events.type", "invitation_send")
    .order("created_at", { ascending: false });
  if (deliveryError) throw deliveryError;

  const latestByParty = new Map<string, string | null>();
  for (const delivery of (deliveries ?? []) as Array<{
    invitation_party_id: string | null;
    status: string | null;
  }>) {
    if (!delivery.invitation_party_id || latestByParty.has(delivery.invitation_party_id)) continue;
    latestByParty.set(delivery.invitation_party_id, delivery.status ?? null);
  }

  return rows.map((row) => ({
    ...row,
    latest_invitation_delivery_status: row.invitation_party_id
      ? latestByParty.get(row.invitation_party_id) ?? null
      : null,
  }));
}
