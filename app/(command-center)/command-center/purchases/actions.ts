"use server";
import { requireStaff } from "@/lib/admin/server";
import { parseLookup, parseLookupForm, type LookupResult } from "@/lib/admin/cc";

// READ-ONLY customer lookup for support. POST (a server action), never a URL, so a customer's email never lands in a URL, a log or analytics.
// The database function checks support.read again and writes an audit row (no email in the audit detail). It cannot change anything.
export type LookupState = { status: "idle" } | { status: "error"; code: string } | { status: "done"; result: LookupResult };

export async function lookupCustomer(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const { supabase } = await requireStaff("support.read", "/command-center/purchases");
  const parsed = parseLookupForm(formData);
  if (!parsed.ok) return { status: "error", code: parsed.error };
  const { data, error } = await supabase.rpc("admin_entitlement_lookup", { p_query: parsed.query });
  if (error) return { status: "error", code: "failed" };
  const result = parseLookup(data);
  return result ? { status: "done", result } : { status: "error", code: "failed" };
}
