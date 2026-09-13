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

interface GuestUpdateRow {
  id: string;
  category: string;
  title: string;
  body: string;
  importance: string;
  require_acknowledgement: boolean;
  audience: string;
  published_at: string;
}

export interface GuestExperienceUpdate extends GuestUpdateRow {
  targeted: number;
  seen: number;
  acknowledged: number;
  seenNames: string[];
  unseenNames: string[];
  acknowledgedNames: string[];
  unacknowledgedNames: string[];
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

  const parties: GuestExperienceParty[] = (partyRows ?? []).map((p: { id: string; party_name: string | null }) => ({
    id: p.id,
    name: p.party_name || "Guest / household",
  }));
  const partyNameById = new Map(parties.map((party) => [party.id, party.name]));
  const allPartyIds = new Set(parties.map((party) => party.id));
  const comingPartyIds = new Set<string>();
  const awaitingPartyIds = new Set<string>();
  for (const row of guestRows ?? []) {
    if (!row.invitation_party_id) continue;
    if (row.rsvp_status === "yes" || row.rsvp_status === "maybe") comingPartyIds.add(row.invitation_party_id);
    if (row.rsvp_status === "no_response") awaitingPartyIds.add(row.invitation_party_id);
  }

  const rows = (updateRows ?? []) as GuestUpdateRow[];
  const updateIds = rows.map((u) => u.id);
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

  const namesFor = (ids: Iterable<string>) => Array.from(ids)
    .map((id) => partyNameById.get(id) ?? "Guest / household")
    .sort((a, b) => a.localeCompare(b));

  const updates: GuestExperienceUpdate[] = rows.map((u) => {
    const targetIds = u.audience === "coming"
      ? comingPartyIds
      : u.audience === "awaiting"
        ? awaitingPartyIds
        : u.audience === "selected"
          ? selectedByUpdate.get(u.id) ?? new Set<string>()
          : allPartyIds;
    const receipts = (receiptsByUpdate.get(u.id) ?? []).filter((r) => targetIds.has(r.invitation_party_id));
    const seenIds = new Set(receipts.map((r) => r.invitation_party_id));
    const acknowledgedIds = new Set(receipts.filter((r) => !!r.acknowledged_at).map((r) => r.invitation_party_id));
    const unseenIds = new Set(Array.from(targetIds).filter((id) => !seenIds.has(id)));
    const unacknowledgedIds = new Set(Array.from(targetIds).filter((id) => !acknowledgedIds.has(id)));

    return {
      ...u,
      targeted: targetIds.size,
      seen: seenIds.size,
      acknowledged: acknowledgedIds.size,
      seenNames: namesFor(seenIds),
      unseenNames: namesFor(unseenIds),
      acknowledgedNames: namesFor(acknowledgedIds),
      unacknowledgedNames: namesFor(unacknowledgedIds),
    };
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
