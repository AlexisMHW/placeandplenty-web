"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { knownCode } from "@/lib/admin/messages";
import { parseDestinationForm, parseEmailToggleForm, parseRetryForm, parseStateForm, parseThresholdsForm, parseVerifyForm } from "@/lib/admin/notifications";

// FOUNDER NOTIFICATION ACTIONS (decision D5). Acknowledge/resolve: any staff member, but the database only lets them touch notifications their own role may see.
// Destination, verification, email on/off, thresholds and retry: staff.manage (owner), checked here and in the database; each writes an audit row.
// NOTHING HERE SENDS EMAIL. These actions queue or configure; the mail dispatcher is a separate, flag-controlled job. queued is not sent; sent is not delivered.
// The address is never hardcoded anywhere in code: the owner types it on the settings screen. The verification code is never returned to the browser.
const INBOX = "/command-center/inbox", SETTINGS = "/command-center/inbox/settings";
type R = { ok: boolean; code: string };

export async function setNotificationState(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff(undefined, INBOX);
  const p = parseStateForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("admin_set_notification_state", { p_id: p.value.id, p_state: p.value.state });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(INBOX); revalidatePath("/command-center");
  return { ok: true, code: "saved" };
}
export async function setDestination(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("staff.manage", SETTINGS);
  const p = parseDestinationForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("admin_set_notification_destination", { p_email: p.value.email });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(SETTINGS);
  return { ok: true, code: "saved" };
}
export async function verifyDestination(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("staff.manage", SETTINGS);
  const p = parseVerifyForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { data, error } = await supabase.rpc("admin_verify_notification_destination", { p_code: p.value.code });
  if (error) return { ok: false, code: knownCode(error.message) };
  if (data !== "verified") return { ok: false, code: typeof data === "string" ? knownCode(data) : "failed" };
  revalidatePath(SETTINGS);
  return { ok: true, code: "saved" };
}
export async function setEmailEnabled(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("staff.manage", SETTINGS);
  const p = parseEmailToggleForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("admin_set_notification_email_enabled", { p_enabled: p.value.enabled, p_min_severity: p.value.minSeverity });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(SETTINGS);
  return { ok: true, code: "saved" };
}
export async function setThresholds(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("staff.manage", SETTINGS);
  const p = parseThresholdsForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("admin_set_notification_thresholds", { p_awaiting_review_hours: p.value.review, p_payout_approval_hours: p.value.payout });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(SETTINGS);
  return { ok: true, code: "saved" };
}
export async function retryDelivery(formData: FormData): Promise<R> {
  const { supabase } = await requireStaff("staff.manage", SETTINGS);
  const p = parseRetryForm(formData); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("admin_retry_notification_delivery", { p_id: p.value.id });
  if (error) return { ok: false, code: knownCode(error.message) };
  revalidatePath(SETTINGS);
  return { ok: true, code: "saved" };
}
