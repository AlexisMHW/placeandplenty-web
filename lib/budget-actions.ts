"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

function refresh(gatheringId: string) {
  revalidatePath(`/host/g/${gatheringId}/shopping`);
  revalidatePath(`/host/g/${gatheringId}`);
}

function fail(error: { message?: string; code?: string } | null): ActionResult {
  const raw = error?.message ?? "";
  if (raw.includes("gathering_archived_read_only")) return { ok: false, message: "This gathering is archived, so it can’t be changed." };
  if (raw.includes("not_authorized") || error?.code === "42501") return { ok: false, message: "You don’t have access to change that." };
  return { ok: false, message: "That didn’t save. Please try again." };
}

export async function updateBudgetTargetWeb(gatheringId: string, value: number | null): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("gatherings")
    .update({ budget_target: value })
    .eq("id", gatheringId)
    .select("id");
  if (result.error) return fail(result.error);
  if (!result.data?.length) return { ok: false, message: "That gathering is no longer available to change." };
  refresh(gatheringId);
  return { ok: true };
}

export async function updateSpentOverrideWeb(gatheringId: string, value: number | null): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("gatherings")
    .update({ spent_override: value })
    .eq("id", gatheringId)
    .select("id");
  if (result.error) return fail(result.error);
  if (!result.data?.length) return { ok: false, message: "That gathering is no longer available to change." };
  refresh(gatheringId);
  return { ok: true };
}

export async function createExpenseWeb(gatheringId: string, formData: FormData): Promise<ActionResult> {
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: "Enter a valid amount." };

  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in again to save this expense." };

  const supabase = createClient();
  const { error } = await supabase.from("gathering_expenses").insert({
    gathering_id: gatheringId,
    amount,
    category: String(formData.get("category") ?? "").trim() || null,
    merchant: String(formData.get("merchant") ?? "").trim() || null,
    expense_date: String(formData.get("expense_date") ?? "").trim() || new Date().toISOString().slice(0, 10),
    note: String(formData.get("note") ?? "").trim().slice(0, 500) || null,
    created_by: user.id,
  });
  if (error) return fail(error);
  refresh(gatheringId);
  return { ok: true };
}

export async function deleteExpenseWeb(gatheringId: string, expenseId: string): Promise<ActionResult> {
  const supabase = createClient();
  const result = await supabase
    .from("gathering_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("gathering_id", gatheringId)
    .select("id");
  if (result.error) return fail(result.error);
  if (!result.data?.length) return { ok: false, message: "That expense is already gone." };
  refresh(gatheringId);
  return { ok: true };
}

export async function attachReceiptWeb(gatheringId: string, expenseId: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a receipt image first." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "Receipts must be image files." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "That receipt is too large. Use an image under 10 MB." };

  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in again to upload this receipt." };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${gatheringId}/${randomUUID()}.${extension}`;
  const supabase = createClient();
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return fail(uploadError);

  const { error } = await supabase.from("gathering_expense_receipts").insert({
    expense_id: expenseId,
    gathering_id: gatheringId,
    storage_path: path,
    mime_type: file.type,
    uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from("receipts").remove([path]);
    return fail(error);
  }

  refresh(gatheringId);
  return { ok: true };
}
