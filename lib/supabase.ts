import { createClient } from "@supabase/supabase-js";

// Publishable client for browser-safe Supabase interactions. Public marketing
// forms do NOT write tables directly anymore; they go through the
// public-form-submit Edge Function, which rate-limits the server-observed
// request fingerprint before a service-context insert.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "failed" };

async function submitPublicForm(
  formType: "guest_list" | "founding_host",
  data: Record<string, unknown>
): Promise<SubmitResult> {
  if (!supabaseUrl || !supabaseAnonKey) return { ok: false, reason: "failed" };
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/public-form-submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ formType, data }),
    });
    if (!response.ok) return { ok: false, reason: "failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/* ------------------------------------------------------------------ */
/* Guest List                                                          */
/* ------------------------------------------------------------------ */

export interface MarketingLead {
  first_name: string;
  email: string;
  upcoming_gathering_type?: string;
  source: string;
  consent: boolean;
}

export async function submitGuestListSignup(
  lead: MarketingLead
): Promise<SubmitResult> {
  const first_name = lead.first_name.trim();
  const email = lead.email.trim();

  if (!first_name) {
    return { ok: false, reason: "invalid", message: "Please add your first name." };
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return {
      ok: false,
      reason: "invalid",
      message: "That email address doesn't look right.",
    };
  }

  return submitPublicForm("guest_list", {
    first_name: first_name.slice(0, 120),
    email,
    upcoming_gathering_type: lead.upcoming_gathering_type?.slice(0, 120) || null,
    source: lead.source.slice(0, 120),
    consent: lead.consent,
    website: "",
  });
}

/* ------------------------------------------------------------------ */
/* Founding Host                                                       */
/* ------------------------------------------------------------------ */

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
): Promise<SubmitResult> {
  const first_name = application.first_name.trim();
  const email = application.email.trim();
  const hosting_what = application.hosting_what.trim();

  if (!first_name) {
    return { ok: false, reason: "invalid", message: "Please add your first name." };
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return {
      ok: false,
      reason: "invalid",
      message: "That email address doesn't look right.",
    };
  }
  if (!hosting_what) {
    return {
      ok: false,
      reason: "invalid",
      message: "Tell us what you're hosting.",
    };
  }
  const gathering_date = application.gathering_date?.trim() ?? "";
  if (gathering_date && !/^\d{4}-\d{2}-\d{2}$/.test(gathering_date)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Please pick a valid gathering date.",
    };
  }

  return submitPublicForm("founding_host", {
    first_name: first_name.slice(0, 120),
    email,
    hosting_what: hosting_what.slice(0, 200),
    gathering_date,
    estimated_guest_count: application.estimated_guest_count?.slice(0, 60) ?? "",
    hosting_frequency: application.hosting_frequency?.slice(0, 120) ?? "",
    interest_reason: application.interest_reason?.slice(0, 4000) ?? "",
    website: "",
  });
}
