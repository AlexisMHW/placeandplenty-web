import { createClient } from "@/lib/supabase-server";

export type MultiDayAccess = {
  hasPass: boolean;
  hasExtension: boolean;
  maxDays: 4 | 7;
};

export type ScheduleDay = {
  id: string;
  day_date: string;
  title: string | null;
  notes: string | null;
  sort_order: number;
};

export type ScheduleActivity = {
  id: string;
  gathering_day_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  location_address: string | null;
  attire_notes: string | null;
  transportation_notes: string | null;
  reservation_notes: string | null;
  vendor_name: string | null;
  vendor_contact: string | null;
  capacity: number | null;
  guest_visibility: "all_invited" | "accepted_guests" | "selected_guests";
  is_selectable: boolean;
  selection_group: string | null;
  sort_order: number;
};

export type ActivityResponse = {
  activity_id: string;
  gathering_guest_id: string;
  rsvp_status: string;
  selected: boolean;
  notes: string | null;
  responded_at: string | null;
};

export type VisibleGuest = {
  activity_id: string;
  gathering_guest_id: string;
};

export type ActivityPayment = {
  id: string;
  activity_id: string;
  invitation_party_id: string | null;
  gathering_guest_id: string | null;
  label: string | null;
  amount_due: number;
  amount_paid: number;
  notes: string | null;
};

export type ScheduleGuest = {
  id: string;
  invitation_party_id: string | null;
  rsvp_status: string;
  first_name: string;
  last_name: string | null;
  household_name: string | null;
};

export type PlanningRecord = {
  id: string;
  label: string;
  gathering_day_id: string | null;
  gathering_activity_id: string | null;
};

export type MultiDayWorkspace = {
  access: MultiDayAccess;
  days: ScheduleDay[];
  activities: ScheduleActivity[];
  responses: ActivityResponse[];
  visibleGuests: VisibleGuest[];
  payments: ActivityPayment[];
  guests: ScheduleGuest[];
  planning: {
    menu: PlanningRecord[];
    shopping: PlanningRecord[];
    contributions: PlanningRecord[];
    expenses: PlanningRecord[];
  };
};

export async function getMultiDayWorkspace(gatheringId: string): Promise<MultiDayWorkspace> {
  const supabase = createClient();

  const [passRes, extensionRes, daysRes, activitiesRes, rsvpRes, visibleRes, paymentRes, guestRes, menuRes, shoppingRes, contributionRes, expenseRes] =
    await Promise.all([
      supabase.rpc("gathering_has_multi_day_access", { p_gathering_id: gatheringId }),
      supabase.rpc("gathering_has_multi_day_extension", { p_gathering_id: gatheringId }),
      supabase.from("gathering_days").select("id,day_date,title,notes,sort_order").eq("gathering_id", gatheringId).order("day_date"),
      supabase.from("gathering_activities").select("id,gathering_day_id,title,description,start_time,end_time,location_name,location_address,attire_notes,transportation_notes,reservation_notes,vendor_name,vendor_contact,capacity,guest_visibility,is_selectable,selection_group,sort_order").eq("gathering_id", gatheringId).order("sort_order"),
      supabase.from("gathering_activity_rsvps").select("activity_id,gathering_guest_id,rsvp_status,selected,notes,responded_at").eq("gathering_id", gatheringId),
      supabase.from("gathering_activity_visible_guests").select("activity_id,gathering_guest_id").eq("gathering_id", gatheringId),
      supabase.from("gathering_activity_payment_ledger").select("id,activity_id,invitation_party_id,gathering_guest_id,label,amount_due,amount_paid,notes").eq("gathering_id", gatheringId),
      supabase.from("gathering_guests").select("id,invitation_party_id,rsvp_status,guest:guests(first_name,last_name,household_name)").eq("gathering_id", gatheringId),
      supabase.from("menu_items").select("id,name,gathering_day_id,gathering_activity_id").eq("gathering_id", gatheringId).order("name"),
      supabase.from("shopping_items").select("id,name,gathering_day_id,gathering_activity_id").eq("gathering_id", gatheringId).order("name"),
      supabase.from("contributions").select("id,item_name,gathering_day_id,gathering_activity_id").eq("gathering_id", gatheringId).order("item_name"),
      supabase.from("gathering_expenses").select("id,merchant,note,gathering_day_id,gathering_activity_id").eq("gathering_id", gatheringId).order("created_at"),
    ]);

  const firstError = [
    daysRes.error, activitiesRes.error, rsvpRes.error, visibleRes.error,
    paymentRes.error, guestRes.error, menuRes.error, shoppingRes.error,
    contributionRes.error, expenseRes.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const guests = (guestRes.data ?? []).map((row: any) => ({
    id: String(row.id),
    invitation_party_id: row.invitation_party_id ? String(row.invitation_party_id) : null,
    rsvp_status: String(row.rsvp_status ?? "no_response"),
    first_name: String(row.guest?.first_name ?? "Guest"),
    last_name: row.guest?.last_name ? String(row.guest.last_name) : null,
    household_name: row.guest?.household_name ? String(row.guest.household_name) : null,
  }));

  const mapPlanning = (rows: any[], labelKey: string): PlanningRecord[] =>
    rows.map((row) => ({
      id: String(row.id),
      label: String(row[labelKey] ?? row.note ?? "Item"),
      gathering_day_id: row.gathering_day_id ? String(row.gathering_day_id) : null,
      gathering_activity_id: row.gathering_activity_id ? String(row.gathering_activity_id) : null,
    }));

  return {
    access: {
      hasPass: passRes.data === true,
      hasExtension: extensionRes.data === true,
      maxDays: extensionRes.data === true ? 7 : 4,
    },
    days: (daysRes.data ?? []) as ScheduleDay[],
    activities: (activitiesRes.data ?? []) as ScheduleActivity[],
    responses: (rsvpRes.data ?? []) as ActivityResponse[],
    visibleGuests: (visibleRes.data ?? []) as VisibleGuest[],
    payments: (paymentRes.data ?? []).map((row: any) => ({ ...row, amount_due: Number(row.amount_due ?? 0), amount_paid: Number(row.amount_paid ?? 0) })) as ActivityPayment[],
    guests,
    planning: {
      menu: mapPlanning(menuRes.data ?? [], "name"),
      shopping: mapPlanning(shoppingRes.data ?? [], "name"),
      contributions: mapPlanning(contributionRes.data ?? [], "item_name"),
      expenses: mapPlanning(expenseRes.data ?? [], "merchant"),
    },
  };
}
