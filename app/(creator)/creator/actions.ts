"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { codeFrom, type ActionResult } from "@/lib/hc/lifecycle";
import { parseLeaveResult, parseRejoinResult } from "@/lib/hc/membership";
import { parseSubmissionForm, parseAssignmentResponse, parseOnboardingStep } from "@/lib/hc/creator-forms";

// CREATOR ACTIONS. Each one requires a signed-in user and calls ONE database function that only ever touches the caller's own rows
// (the database re-checks everything). No service-role key. Only a short known code is returned; database error text is never forwarded.
async function authed() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function withdrawApplication(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const { error } = await supabase.rpc("creator_withdraw_application");
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath("/creator"); return { ok: true, code: "withdrawn" };
}

export async function leaveCollective(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const { data, error } = await supabase.rpc("creator_leave_collective");
  if (error) return { ok: false, code: codeFrom(error.message) };
  if (!parseLeaveResult(data)) return { ok: false, code: "failed" };
  revalidatePath("/creator"); return { ok: true, code: "left" };
}

export async function rejoinCollective(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const { data, error } = await supabase.rpc("creator_rejoin_collective");
  if (error) return { ok: false, code: codeFrom(error.message) };
  if (!parseRejoinResult(data)) return { ok: false, code: "failed" };
  revalidatePath("/creator"); return { ok: true, code: "rejoined" };
}

export async function respondToAssignment(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const p = parseAssignmentResponse(fd); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("creator_respond_assignment", { p_assignment_id: p.value.id, p_accept: p.value.accept });
  if (error) return { ok: false, code: codeFrom(error.message, /not_offered|closed|expired/) };
  revalidatePath("/creator"); return { ok: true, code: "saved" };
}

export async function submitContent(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const p = parseSubmissionForm(fd); if (!p.ok) return { ok: false, code: p.error };
  const v = p.value;
  const { error } = await supabase.rpc("creator_submit_content", {
    p_assignment_id: v.assignmentId, p_url: v.url, p_platform: v.platform, p_description: v.description, p_disclosure_confirmed: v.disclosureConfirmed,
  });
  if (error) return { ok: false, code: codeFrom(error.message, /disclosure_required|closed|expired|not_offered/) };
  revalidatePath("/creator"); return { ok: true, code: "saved" };
}

export async function completeOnboardingStep(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await authed(); if (!supabase) return { ok: false, code: "not_signed_in" };
  const p = parseOnboardingStep(fd); if (!p.ok) return { ok: false, code: p.error };
  const { error } = await supabase.rpc("creator_complete_onboarding_step", { p_step: p.value });
  if (error) return { ok: false, code: codeFrom(error.message) };
  revalidatePath("/creator"); return { ok: true, code: "saved" };
}
