import { createClient } from "@/lib/supabase-server";

// Data access for the authenticated host web app.
//
// EVERY QUERY HERE RUNS AS THE SIGNED-IN USER. There is no ownership
// filter written by hand below, and that is deliberate: RLS already
// enforces it, using the same policies the native app depends on. Adding
// a second `.eq("owner_user_id", user.id)` here would look safer while
// actually being worse — two places to keep in agreement, and a false
// sense that the web app is the thing keeping data private.
//
// The one thing this file MUST do is scope by gathering_id when reading
// a gathering's contents. RLS grants access to every gathering the user
// belongs to; without the filter a host would see every gathering's menu
// items at once. That is a correctness bug rather than a security one —
// nothing leaks across users — but it is still wrong.
//
// §29 CORE PARITY: these are the reads that make the desktop planning
// surfaces work. Where something is missing it is because the surface is
// not built yet, not because it was withheld.

export interface GatheringSummary {
  id: string;
  name: string;
  gathering_type: string;
  gathering_date: string;
  arrival_time: string;
  status: string;
  readiness_state: string | null;
  current_hostready_score: number | null;
  expected_guest_count: number;
  adult_count: number;
  child_count: number;
  location_name: string | null;
  owner_user_id: string;
  invitation_mode: string;
  invitation_status: string;
}

/** Gatherings the signed-in user owns or co-hosts. Soonest first. */
export async function getMyGatherings(): Promise<GatheringSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gatherings")
    .select(
      "id, name, gathering_type, gathering_date, arrival_time, status, readiness_state, current_hostready_score, expected_guest_count, adult_count, child_count, location_name, owner_user_id, invitation_mode, invitation_status"
    )
    .order("gathering_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GatheringSummary[];
}

export async function getGathering(
  id: string
): Promise<GatheringSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gatherings")
    .select(
      "id, name, gathering_type, gathering_date, arrival_time, status, readiness_state, current_hostready_score, expected_guest_count, adult_count, child_count, location_name, owner_user_id, invitation_mode, invitation_status"
    )
    .eq("id", id)
    .maybeSingle();

  // maybeSingle() returns null rather than throwing when RLS filters the
  // row out, which is exactly the behaviour wanted: a gathering the user
  // cannot see is indistinguishable from one that does not exist, and
  // the page turns both into a 404.
  if (error) throw error;
  return (data as GatheringSummary) ?? null;
}

/* ------------------------------------------------------------------ */
/* Gathering contents                                                 */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  servings_planned: number | null;
  servings_recommended: number | null;
  notes: string | null;
}

export async function getMenuItems(gatheringId: string): Promise<MenuItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, category, servings_planned, servings_recommended, notes")
    .eq("gathering_id", gatheringId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  status: string;
  estimated_cost: number | null;
  actual_cost: number | null;
}

export async function getShoppingItems(
  gatheringId: string
): Promise<ShoppingItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .select(
      "id, name, category, quantity, unit, status, estimated_cost, actual_cost"
    )
    .eq("gathering_id", gatheringId)
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShoppingItem[];
}

export interface Expense {
  id: string;
  amount: number;
  category: string | null;
  merchant: string | null;
  expense_date: string | null;
  note: string | null;
}

/**
 * Actual money paid. The table comment is emphatic that this — not the
 * shopping list — is the authoritative source for Spent: shopping rows
 * are planning only and are never counted here. The Budget view must
 * respect that or web and app will disagree about what was spent.
 */
export async function getExpenses(gatheringId: string): Promise<Expense[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_expenses")
    .select("id, amount, category, merchant, expense_date, note")
    .eq("gathering_id", gatheringId)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export interface GatheringGuest {
  id: string;
  rsvp_status: string;
  plus_one_count: number;
  notes: string | null;
  guest_dietary_notes: string | null;
  guest_allergy_notes: string | null;
  invitation_party_id: string | null;
  guest: {
    id: string;
    first_name: string;
    last_name: string | null;
    household_name: string | null;
    email: string | null;
  } | null;
}

export async function getGatheringGuests(
  gatheringId: string
): Promise<GatheringGuest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_guests")
    .select(
      "id, rsvp_status, plus_one_count, notes, guest_dietary_notes, guest_allergy_notes, invitation_party_id, guest:guests(id, first_name, last_name, household_name, email)"
    )
    .eq("gathering_id", gatheringId);
  if (error) throw error;
  return (data ?? []) as unknown as GatheringGuest[];
}

export interface Contribution {
  id: string;
  item_name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  status: string;
  contributor_type: string;
  notes: string | null;
  needs_host_attention: boolean | null;
  attention_reason: string | null;
  guest_id: string | null;
  invitation_party_id: string | null;
}

export async function getContributions(
  gatheringId: string
): Promise<Contribution[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contributions")
    .select(
      "id, item_name, category, quantity, unit, status, contributor_type, notes, needs_host_attention, attention_reason, guest_id, invitation_party_id"
    )
    .eq("gathering_id", gatheringId)
    .order("status", { ascending: true })
    .order("item_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contribution[];
}

export interface CoHost {
  id: string;
  invited_email: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  user_id: string | null;
}

export async function getCoHosts(gatheringId: string): Promise<CoHost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_members")
    .select("id, invited_email, status, invited_at, accepted_at, user_id")
    .eq("gathering_id", gatheringId)
    .order("invited_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CoHost[];
}

/* ------------------------------------------------------------------ */
/* Account level                                                      */
/* ------------------------------------------------------------------ */

export interface SavedGuest {
  id: string;
  first_name: string;
  last_name: string | null;
  household_name: string | null;
  email: string | null;
  phone: string | null;
  guest_type: string;
  dietary_notes: string | null;
  allergy_notes: string | null;
  is_saved: boolean;
}

/**
 * My Guest Book — account-level reusable people (§10). Distinct from My
 * People, which is `gathering_guests` for one gathering. `is_saved`
 * separates people the host deliberately kept from those created in
 * passing for a single gathering.
 */
export async function getGuestBook(): Promise<SavedGuest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guests")
    .select(
      "id, first_name, last_name, household_name, email, phone, guest_type, dietary_notes, allergy_notes, is_saved"
    )
    .order("first_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SavedGuest[];
}

export interface ClosetItem {
  id: string;
  name: string;
  category: string | null;
  quantity_owned: number | null;
  notes: string | null;
  color: string | null;
  material: string | null;
  size_label: string | null;
  capacity_label: string | null;
  archived_at: string | null;
}

/**
 * My Hosting Closet. Its RLS policy carries an entitlement gate —
 * `user_can_access_closet(auth.uid())` — so an unentitled user gets an
 * empty list rather than an error. The page distinguishes "you own
 * nothing yet" from "this is a paid feature" rather than showing an
 * empty state that quietly misrepresents the second as the first.
 */
export async function getClosetItems(): Promise<ClosetItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hosting_closet_items")
    .select(
      "id, name, category, quantity_owned, notes, color, material, size_label, capacity_label, archived_at"
    )
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClosetItem[];
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  timezone: string | null;
  preferred_locale: string | null;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, display_name, timezone, preferred_locale")
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}
