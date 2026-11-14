import { createClient } from "@/lib/supabase-server";

// FEATURE DETECTION for gatherings.guest_count_unknown.
//
// Production does not have the column yet (and expected_guest_count is NOT
// NULL there); QA does. The web app must run on both, so anything that would
// READ or WRITE the column asks here first. Postgres reports a missing column
// as 42703; that is the only answer treated as "definitely not supported".
// Any other error is "don't know", which is treated as unsupported for writes
// (never write NULL on a guess) and is not cached.

let cached: boolean | null = null;

export async function supportsGuestCountUnknown(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const supabase = createClient();
    const { error } = await supabase.from("gatherings").select("guest_count_unknown").limit(1);
    if (!error) {
      cached = true;
      return true;
    }
    if (error.code === "42703" || /guest_count_unknown/.test(error.message ?? "")) {
      cached = false;
      return false;
    }
    return false;
  } catch {
    return false;
  }
}

/** For tests only. */
export function resetGuestCountSupportCache(): void {
  cached = null;
}
