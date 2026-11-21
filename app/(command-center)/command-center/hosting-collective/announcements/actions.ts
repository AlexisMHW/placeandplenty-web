"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/server";
import { parseAnnouncementForm } from "@/lib/admin/hc";

const PATH = "/command-center/hosting-collective/announcements";
// Publishing is hc.manage (re-checked in the database). Nothing is emailed or texted: members see it the next time they open /creator.
export async function publishAnnouncement(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const parsed = parseAnnouncementForm(formData);
  if (!parsed.ok) return { ok: false, code: parsed.error };
  const { error } = await supabase.rpc("hc_admin_publish_announcement", { p_title: parsed.value.title, p_body: parsed.value.body, p_tier_slug: parsed.value.tierSlug });
  if (error) return { ok: false, code: /tier_not_found|invalid_title|invalid_body|not_authorized/.exec(error.message ?? "")?.[0] ?? "failed" };
  revalidatePath(PATH); revalidatePath("/creator");
  return { ok: true, code: "saved" };
}

export async function retractAnnouncement(formData: FormData): Promise<{ ok: boolean; code: string }> {
  const { supabase } = await requireStaff("hc.manage", PATH);
  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, code: "invalid_id" };
  const { error } = await supabase.rpc("hc_admin_retract_announcement", { p_id: id });
  if (error) return { ok: false, code: /not_authorized/.test(error.message ?? "") ? "not_authorized" : "failed" };
  revalidatePath(PATH); revalidatePath("/creator");
  return { ok: true, code: "saved" };
}
