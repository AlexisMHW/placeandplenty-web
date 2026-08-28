import { createClient } from "@supabase/supabase-js";

// Publishable key only. Both tables below are INSERT-only for anon and
// authenticated — SELECT, UPDATE and DELETE are revoked — so this client
// can add a lead and can never read one back.
//
// Both tables live in the shared app/Supabase migration history. If they
// ever need to change, the migration belongs in the app repo. There is
// one backend and one migration chain; this repo must never grow a
// second.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Mirrors the database CHECK so a typo gets a kind message, not a 400. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "failed" };

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

/**
 * Plain INSERT, deliberately — not an upsert.
 *
 * marketing_leads has a unique index on email, and a BEFORE INSERT
 * trigger that refreshes the existing row and returns NULL when the
 * address is already on the list. PostgREST still answers 201, so a
 * returning subscriber sees "You're on the Guest List" — which is true.
 *
 * An upsert would be wrong twice over: anon has no UPDATE grant, so
 * ON CONFLICT DO UPDATE could not run, and the trigger already does the
 * right thing.
 *
 * created_at is not sent. The trigger stamps it, and the database owns
 * the clock. Same for the normalising of names, casing and blanks — all
 * server-side, so this client and the app cannot drift apart on it.
 */
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

  const { error } = await supabase.from("marketing_leads").insert([
    {
      first_name: first_name.slice(0, 120),
      email,
      upcoming_gathering_type: lead.upcoming_gathering_type?.slice(0, 120) || null,
      source: lead.source.slice(0, 120),
      consent: lead.consent,
    },
  ]);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Guest list signup failed:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
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

/**
 * Repeat applications create new rows by design — someone applying again
 * about a different gathering is new information, not a correction.
 *
 * All seven keys are always sent. The table's trigger turns "" into NULL
 * for every optional field, so "no answer" stays distinguishable from an
 * empty string, and it stamps created_at itself.
 */
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
  // The column accepts NULL or exactly YYYY-MM-DD. An <input type="date">
  // gives us that or "", and "" becomes NULL server-side.
  const gathering_date = application.gathering_date?.trim() ?? "";
  if (gathering_date && !/^\d{4}-\d{2}-\d{2}$/.test(gathering_date)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Please pick a valid gathering date.",
    };
  }

  const { error } = await supabase.from("founding_host_applications").insert([
    {
      first_name: first_name.slice(0, 120),
      email,
      hosting_what: hosting_what.slice(0, 200),
      gathering_date,
      estimated_guest_count: application.estimated_guest_count?.slice(0, 60) ?? "",
      hosting_frequency: application.hosting_frequency?.slice(0, 120) ?? "",
      interest_reason: application.interest_reason?.slice(0, 4000) ?? "",
    },
  ]);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Founding host application failed:", error.message);
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}
