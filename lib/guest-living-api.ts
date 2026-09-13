const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
  };
}

export interface GuestUpdateItem {
  id: string;
  category: string;
  title: string;
  body: string;
  importance: "normal" | "important";
  requireAcknowledgement: boolean;
  publishedAt: string;
  seenAt: string | null;
  acknowledgedAt: string | null;
}

export interface GuestLivingData {
  attire: string | null;
  arrivalParking: string | null;
  transportation: string | null;
  whatToBring: string | null;
  importantDetails: string | null;
  updates: GuestUpdateItem[];
  isArchived: boolean;
}

export interface GuestLivingResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<GuestLivingResult<T>> {
  const response = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let data: T | null = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

export function lookupGuestLivingPage(token: string) {
  return call<GuestLivingData>("guest-living-page-lookup", { token });
}

export function acknowledgeGuestUpdate(token: string, updateId: string) {
  return call<{ acknowledgedAt: string }>("guest-update-acknowledge", { token, updateId });
}
