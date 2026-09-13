import { createClient } from "@/lib/supabase-server";

export interface GuestExperienceSettings {
  attire_text: string | null;
  arrival_parking_text: string | null;
  transportation_text: string | null;
  what_to_bring_text: string | null;
  important_details_text: string | null;
  show_song_request: boolean;
}

export interface GuestExperienceParty {
  id: string;
  name: string;
}

export interface GuestExperienceUpdate {
  id: string;
  category: string;
  title: string;
  body: string;
  importance: string;
  require_acknowledgement: boolean;
  audience: string;
  published_at: string;
  targeted: number;
  seen: number;
  acknowledged: number;
}

export async function getGuestExperience(gatheringId: string): Promise<{
  settings: GuestExperienceSettings;
  parties: GuestExperienceParty[];
  updates: GuestExperienceUpdate[];
}> {
  const supabase = createClient();

  const [{ data: page, error: pageError }, { data: partyRows, error: partyError }, { data: guestRows, error: guestError }, { data: updateRows, error: updateError }] = await Promise.all([
    supabase
      .from("gathering_guest_page")
      .select("attire_text, arrival_parking_text, transportation_text, what_to_bring_text, important_details_text, show_song_request")
      .eq("gathering_id", gatheringId)
      .maybeSingle(),
    supabase.from("invitation_parties").select("id, party_name").eq("gathering_id", gatheringId),
    supabase.from("gathering_guests").select("invitation_party_id, rsvp_status").eq("gathering_id", gatheringId),
    supabase
      .from("guest_updates")
      .select("id, category, title, body, importance, require_acknowledgement, audience, published_at")
      .eq("gathering_id", gatheringId)
      .order("published_at", { ascending: false }),
  ]);

  if (pageError) throw pageError;
  if (partyError) throw partyError;
  if (guestError) throw guestError;
  if (updateError) throw updateError;

  const parties = (partyRows ?? []).map((p: { id: string; party_name: string | null }) => ({
    id: p.id,
    name: p.party_name || "Guest / household",
  }));
  const allPartyIds = new Set(parties.map((p) => p.id));
  const comingPartyIds = new Set<string>();
  const awaitingPartyIds = new Set<string>();
  for (const row of guestRows ?? []) {
    if (!row.invitation_party_id) continue;
    if (row.rsvp_status === "yes" || row.rsvp_status === "maybe") comingPartyIds.add(row.invitation_party_id);
    if (row.rsvp_status === "invited" || row.rsvp_status === "no_response") awaitingPartyIds.add(row.invitation_party_id);
  }

  const updateIds = (updateRows ?? []).map((u: { id: string }) => u.id);
  const [{ data: selectedRows }, { data: receiptRows }] = updateIds.length > 0
    ? await Promise.all([
        supabase.from("guest_update_audience_parties").select("guest_update_id, invitation_party_id").in("guest_update_id", updateIds),
        supabase.from("guest_update_receipts").select("guest_update_id, invitation_party_id, acknowledged_at").in("guest_update_id", updateIds),
      ])
    : [{ data: [] }, { data: [] }];

  const selectedByUpdate = new Map<string, Set<string>>();
  for (const row of selectedRows ?? []) {
    const set = selectedByUpdate.get(row.guest_update_id) ?? new Set<string>();
    set.add(row.invitation_party_id);
    selectedByUpdate.set(row.guest_update_id, set);
  }
  const receiptsByUpdate = new Map<string, Array<{ invitation_party_id: string; acknowledged_at: string | null }>>();
  for (const row of receiptRows ?? []) {
    const list = receiptsByUpdate.get(row.guest_update_id) ?? [];
    list.push(row);
    receiptsByUpdate.set(row.guest_update_id, list);
  }

  const updates = (updateRows ?? []).map((u: any) => {
    const targetIds = u.audience === "coming"
      ? comingPartyIds
      : u.audience === "awaiting"
        ? awaitingPartyIds
        : u.audience === "selected"
          ? selectedByUpdate.get(u.id) ?? new Set<string>()
          : allPartyIds;
    const receipts = (receiptsByUpdate.get(u.id) ?? []).filter((r) => targetIds.has(r.invitation_party_id));
    return {
      ...u,
      targeted: targetIds.size,
      seen: receipts.length,
      acknowledged: receipts.filter((r) => !!r.acknowledged_at).length,
    } as GuestExperienceUpdate;
  });

  return {
    settings: {
      attire_text: page?.attire_text ?? null,
      arrival_parking_text: page?.arrival_parking_text ?? null,
      transportation_text: page?.transportation_text ?? null,
      what_to_bring_text: page?.what_to_bring_text ?? null,
      important_details_text: page?.important_details_text ?? null,
      show_song_request: !!page?.show_song_request,
    },
    parties,
    updates,
  };
}
