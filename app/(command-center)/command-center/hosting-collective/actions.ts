"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { submitApplicationReview } from "@/lib/hc/review-flow";
import { afterApplicationDecision } from "@/lib/hc/dispatch-runner";
import { runConfiguredHcDispatch } from "@/lib/hc/dispatch-server";
import { parseReviewForm, parseSubmissionReviewForm } from "@/lib/admin/hc";

// SERVER ACTIONS. Each one (1) re-checks the staff permission on the server, (2) validates the form, (3) calls ONE database
// function that checks the permission again and writes the audit log. No direct table writes. The service-role key is touched only by lib/hc/dispatch-server.ts, and only when HC_NOTIFY_DISPATCH_ENABLED is on (default off).
// Return value is only a short code the page may show; database error text is never forwarded to the browser.

export async function reviewApplication(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.applications.review", "/command-center/hosting-collective/applications");
  const parsed = parseReviewForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  const result = await submitApplicationReview(supabase, v, (decision) => afterApplicationDecision(decision, runConfiguredHcDispatch));
  if (!result.ok) return result;
  revalidatePath("/command-center/hosting-collective/applications");
  return result;
}

export async function reviewSubmission(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.content.review", "/command-center/hosting-collective/content");
  const parsed = parseSubmissionReviewForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const v = parsed.value;
  const { error } = await supabase.rpc("hc_admin_review_submission", { p_id: v.id, p_decision: v.decision, p_note: v.note });
  if (error) return { ok: false, code: "failed" };
  revalidatePath("/command-center/hosting-collective/content");
  return { ok: true, code: "saved" };
}

export async function acknowledgeNotification(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", "/command-center/hosting-collective");
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, code: "invalid_id" };
  const { error } = await supabase.rpc("hc_admin_ack_notification", { p_id: id });
  if (error) return { ok: false, code: "failed" };
  revalidatePath("/command-center/hosting-collective");
  return { ok: true, code: "saved" };
}
