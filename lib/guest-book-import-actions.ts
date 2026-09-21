"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase-server";
import type { GuestBookImportRow } from "@/lib/guest-book-csv";

export type GuestBookImportResult =
  | { ok: true; imported: number }
  | { ok: false; message: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export async function importGuestBookRows(
  rows: GuestBookImportRow[]
): Promise<GuestBookImportResult> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Sign in again before importing." };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "There is nothing to import." };
  if (rows.length > 1000) return { ok: false, message: "Import up to 1,000 people at a time." };

  const seenEmails = new Set<string>();
  const payload: Array<Record<string, unknown>> = [];

  for (const raw of rows) {
    const firstName = clean(raw.firstName, 120);
    const lastName = clean(raw.lastName, 120);
    const email = clean(raw.email, 320).toLowerCase();
    const phone = clean(raw.phone, 80);
    const notes = clean(raw.notes, 1000);

    if (!firstName) return { ok: false, message: `Row ${raw.rowNumber}: First Name is required.` };
    if (email && !EMAIL_RE.test(email)) {
      return { ok: false, message: `Row ${raw.rowNumber}: Email address is not valid.` };
    }
    if (email && seenEmails.has(email)) {
      return { ok: false, message: `Row ${raw.rowNumber}: Duplicate email address in this import.` };
    }
    if (email) seenEmails.add(email);

    payload.push({
      owner_user_id: user.id,
      first_name: firstName,
      last_name: lastName || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      guest_type: "adult",
      is_saved: true,
    });
  }

  const supabase = createClient();
  const { data, error } = await supabase.from("guests").insert(payload).select("id");

  if (error) {
    if ((error.message ?? "").includes("guests_owner_email_unique")) {
      return {
        ok: false,
        message: "A duplicate appeared while importing. Choose the file again and we’ll re-check it against your Guest Book.",
      };
    }
    return { ok: false, message: "We couldn’t finish the import. Your existing Guest Book was not changed." };
  }

  revalidatePath("/host/guest-book");
  revalidatePath("/host");
  return { ok: true, imported: data?.length ?? payload.length };
}
