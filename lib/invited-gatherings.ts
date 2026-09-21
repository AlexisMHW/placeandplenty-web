import { createClient } from "@/lib/supabase-server";

export type InvitedGathering = {
  bindingId: string;
  invitationPartyId: string;
  guestId: string | null;
  publicToken: string;
  partyName: string;
  guestOnly: true;
  section: "upcoming" | "past";
  rsvpStatus: string;
  gathering: {
    id: string;
    name: string;
    hostDisplayName: string | null;
    date: string;
    arrivalTime: string;
    timezone: string;
    locationName: string | null;
    status: string;
    cancellationMessage: string | null;
  };
};

export type InvitedGatheringsPayload = {
  verifiedEmail: string;
  upcoming: InvitedGathering[];
  past: InvitedGathering[];
};

export async function getMyInvitedGatherings(): Promise<InvitedGatheringsPayload> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("my-invited-gatherings", {
    method: "POST",
    body: {},
  });

  if (error) throw error;

  const payload = data as Partial<InvitedGatheringsPayload> | null;
  return {
    verifiedEmail: payload?.verifiedEmail ?? "",
    upcoming: Array.isArray(payload?.upcoming) ? payload!.upcoming! : [],
    past: Array.isArray(payload?.past) ? payload!.past! : [],
  };
}
