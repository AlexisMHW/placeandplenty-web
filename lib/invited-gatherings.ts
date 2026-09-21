import { createClient } from "@/lib/supabase-server";

export class InvitedGatheringsError extends Error {
  code: "verified_email_required" | "load_failed";

  constructor(code: "verified_email_required" | "load_failed", message: string) {
    super(message);
    this.name = "InvitedGatheringsError";
    this.code = code;
  }
}

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
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user) {
    throw new InvitedGatheringsError("load_failed", "Could not verify your account.");
  }

  if (!user.email || !user.email_confirmed_at) {
    throw new InvitedGatheringsError(
      "verified_email_required",
      "Verify your account email to connect invitations safely."
    );
  }

  const { data, error } = await supabase.functions.invoke("my-invited-gatherings", {
    method: "POST",
    body: {},
  });

  if (error) {
    throw new InvitedGatheringsError("load_failed", error.message);
  }

  const payload = data as Partial<InvitedGatheringsPayload> | null;
  return {
    verifiedEmail: payload?.verifiedEmail ?? user.email,
    upcoming: Array.isArray(payload?.upcoming) ? payload!.upcoming! : [],
    past: Array.isArray(payload?.past) ? payload!.past! : [],
  };
}
