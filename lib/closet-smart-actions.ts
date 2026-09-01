"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import type { ActionResult } from "@/lib/host-actions";

export interface SmartClosetMatch {
  entitled: boolean;
  found: boolean;
  closetItemId?: string;
  name?: string;
  quantityOwned?: number;
  quantityNeeded?: number;
  quantityGap?: number;
  fullyCovered?: boolean;
}

export async function checkSmartClosetWeb(
  gatheringId: string,
  needName: string,
  needQuantity: number,
  needCategory: string | null
): Promise<{ ok: true; match: SmartClosetMatch | null } | { ok: false; message: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in again." };

  const { data: gathering, error: gatheringError } = await supabase
    .from("gatherings")
    .select("owner_user_id")
    .eq("id", gatheringId)
    .single();
  if (gatheringError || !gathering) {
    return { ok: false, message: "That gathering is no longer available." };
  }

  // Smart matching intentionally reads the OWNER'S reusable household
  // inventory. The backend forbids one signed-in person from probing
  // another person's Closet, and resolution itself is owner-only. A co-host
  // can still add Shopping items normally; they simply do not receive the
  // owner's private inventory suggestion here.
  if (gathering.owner_user_id !== user.id) return { ok: true, match: null };

  const { data, error } = await supabase.rpc("match_hosting_closet", {
    p_user_id: user.id,
    p_need_name: needName,
    p_need_quantity: Math.max(1, Math.round(needQuantity || 1)),
    p_need_category: needCategory,
    p_gathering_id: gatheringId,
  });
  if (error) return { ok: false, message: "We couldn’t check your Hosting Closet just now." };

  const row = (data ?? {}) as Record<string, unknown>;
  if (row.entitled !== true || row.found !== true) return { ok: true, match: null };

  return {
    ok: true,
    match: {
      entitled: true,
      found: true,
      closetItemId: String(row.closetItemId ?? ""),
      name: typeof row.name === "string" ? row.name : needName,
      quantityOwned: Number(row.quantityOwned ?? 0),
      quantityNeeded: Number(row.quantityNeeded ?? needQuantity),
      quantityGap: Number(row.quantityGap ?? 0),
      fullyCovered: row.fullyCovered === true,
    },
  };
}

export async function resolveSmartClosetWeb(input: {
  gatheringId: string;
  needName: string;
  needQuantity: number;
  closetItemId: string;
  action: "not_now" | "yes" | "borrow" | "rent";
  category: string | null;
  guestId?: string | null;
  memberId?: string | null;
  provider?: string | null;
}): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_need_from_closet", {
    p_gathering_id: input.gatheringId,
    p_need_name: input.needName,
    p_need_quantity: Math.max(1, Math.round(input.needQuantity || 1)),
    p_closet_item_id: input.closetItemId,
    p_action: input.action,
    p_category: input.category,
    p_borrow_from_guest_id: input.guestId ?? null,
    p_borrow_from_member_id: input.memberId ?? null,
    p_provider: input.provider?.trim() || null,
  });

  if (error) {
    const raw = error.message ?? "";
    if (raw.includes("smart_closet_requires_pass_or_plus")) {
      return { ok: false, message: "Smart matching needs a Gathering Pass or Place & Plenty Plus." };
    }
    if (raw.includes("borrow_requires_person")) {
      return { ok: false, message: "Choose who you’re borrowing from." };
    }
    if (raw.includes("not_authorized")) {
      return { ok: false, message: "Only the gathering owner can apply items from their Hosting Closet." };
    }
    return { ok: false, message: "That didn’t save. Please try again." };
  }

  revalidatePath(`/host/g/${input.gatheringId}/shopping`);
  revalidatePath(`/host/g/${input.gatheringId}`);
  revalidatePath("/host/closet");
  return { ok: true };
}
