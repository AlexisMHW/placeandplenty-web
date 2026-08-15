import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Falls back to a no-op-safe client during local dev if env vars aren't
// set yet — real project URL/key get added in Vercel env config.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface MarketingLead {
  first_name: string;
  email: string;
  upcoming_gathering_type?: string;
  source: string;
  consent: boolean;
}

export async function submitGuestListSignup(lead: MarketingLead) {
  const { error } = await supabase.from("marketing_leads").insert([
    {
      ...lead,
      created_at: new Date().toISOString(),
    },
  ]);
  return { error };
}

export interface FoundingHostApplication {
  first_name: string;
  email: string;
  hosting_what: string;
  gathering_date?: string;
  estimated_guest_count?: string;
  hosting_frequency?: string;
  interest_reason?: string;
}

export async function submitFoundingHostApplication(
  application: FoundingHostApplication
) {
  const { error } = await supabase.from("founding_host_applications").insert([
    {
      ...application,
      created_at: new Date().toISOString(),
    },
  ]);
  return { error };
}
