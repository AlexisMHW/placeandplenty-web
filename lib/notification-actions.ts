"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function markHostNotificationRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("host_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id");

  if (error || !data?.length) {
    throw new Error("notification_not_updated");
  }

  revalidatePath("/host/notifications");
}
