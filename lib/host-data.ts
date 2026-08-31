import { createClient } from "@/lib/supabase-server";
import {
  INVITATION_ARTWORK_BUCKET,
  isRenderableArtwork,
} from "@/lib/invitations";

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
  /**
   * THE GATHERING'S IDENTITY. §16 of the visual directive is emphatic:
   * "The gathering's invitation/artwork is the identity of the
   * gathering... Do not replace the gathering identity with generic P&P
   * photography." So this is carried on the summary rather than fetched
   * per surface — the list, the hero and the header all show the same
   * artwork, and a gathering is recognisable at a glance the way it is
   * on the phone.
   *
   * The bucket is private, so a path is not a URL. See signArtwork().
   */
  invitation_artwork_path: string | null;
  /** PDFs are allowed in the bucket and cannot render in an <img>. */
  invitation_artwork_mime_type: string | null;
}

/** Gatherings the signed-in user owns or co-hosts. Soonest first. */
export async function getMyGatherings(): Promise<GatheringSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gatherings")
    .select(
      "id, name, gathering_type, gathering_date, arrival_time, status, readiness_state, current_hostready_score, expected_guest_count, adult_count, child_count, location_name, owner_user_id, invitation_mode, invitation_status, invitation_artwork_path, invitation_artwork_mime_type"
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
      "id, name, gathering_type, gathering_date, arrival_time, status, readiness_state, current_hostready_score, expected_guest_count, adult_count, child_count, location_name, owner_user_id, invitation_mode, invitation_status, invitation_artwork_path, invitation_artwork_mime_type"
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
  accessibility_notes: string | null;
  is_saved: boolean;
}

export interface GuestBook {
  /** The reusable book: people the host deliberately kept. */
  saved: SavedGuest[];
  /**
   * People created in passing for one gathering and never saved. Kept
   * in the database forever so RSVP history survives; shown separately
   * so they are never mistaken for Guest Book entries.
   */
  history: SavedGuest[];
}

/**
 * My Guest Book — account-level reusable people (§10). Distinct from My
 * People, which is `gathering_guests` for one gathering.
 *
 * `is_saved` IS THE WHOLE DISTINCTION, and this function returns the two
 * groups apart rather than one list with a flag. My Guest Book means the
 * people you keep; a one-off guest typed in for a single dinner is not
 * one of them, however much the row looks the same.
 *
 * The unsaved rows are still returned, because deleting them is not an
 * option — `gathering_guests` references them and they carry the RSVP,
 * the dietary note and the contribution for a real gathering. They
 * belong under "Previously invited", where they can be promoted into the
 * book, and nowhere else.
 */
export async function getGuestBook(): Promise<GuestBook> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guests")
    .select(
      "id, first_name, last_name, household_name, email, phone, guest_type, dietary_notes, allergy_notes, accessibility_notes, is_saved"
    )
    .order("first_name", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as SavedGuest[];
  return {
    saved: rows.filter((g) => g.is_saved),
    history: rows.filter((g) => !g.is_saved),
  };
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
  /** Private bucket path. Not a URL — see signClosetPhotos(). */
  storage_path: string | null;
  mime_type: string | null;
}

const CLOSET_COLUMNS =
  "id, name, category, quantity_owned, notes, color, material, size_label, capacity_label, archived_at, storage_path, mime_type";

/**
 * My Hosting Closet — everything the host currently owns.
 *
 * AN EMPTY RESULT HERE MEANS EMPTY, and that is new. The RLS policy on
 * `hosting_closet_items` used to be
 *
 *   owner_user_id = auth.uid() AND user_can_access_closet(auth.uid())
 *
 * which gated ordinary inventory behind a purchase, so an unentitled
 * host got zero rows — indistinguishable from owning nothing. The policy
 * is now `owner_user_id = auth.uid()`, full stop. Basic Closet is a Free
 * capability; what is paid is the SMART layer that matches a gathering's
 * needs against these rows. No surface built on this function may show a
 * paywall.
 */
export async function getClosetItems(): Promise<ClosetItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hosting_closet_items")
    .select(CLOSET_COLUMNS)
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClosetItem[];
}

/**
 * Things the host has marked as no longer owned.
 *
 * Archived rather than deleted, because `gathering_closet_items` rows
 * from past gatherings still point at them — the provenance of "you
 * already had this" outlives the platter.
 */
export async function getArchivedClosetItems(): Promise<ClosetItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("hosting_closet_items")
    .select(CLOSET_COLUMNS)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as ClosetItem[];
}

/**
 * Signed URLs for closet item photos, one round trip for the whole page.
 *
 * The `hosting-closet` bucket is PRIVATE and its policies key on the
 * first path segment being the owner's user id, so a stored path is not
 * something a browser can load. Same reasoning as signArtwork(): sign on
 * the server, for exactly the paths about to be rendered, never by
 * making the bucket public.
 */
export async function signClosetPhotos(
  items: Pick<ClosetItem, "id" | "storage_path">[]
): Promise<Map<string, string>> {
  const withPhotos = items.filter((i) => i.storage_path);
  if (withPhotos.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("hosting-closet")
    .createSignedUrls(
      withPhotos.map((i) => i.storage_path as string),
      ARTWORK_TTL_SECONDS
    );

  // A failure here costs a thumbnail, not a page.
  if (error || !data) return new Map();

  const byPath = new Map<string, string>();
  for (const row of data) {
    if (row.signedUrl && row.path) byPath.set(row.path, row.signedUrl);
  }

  const byItem = new Map<string, string>();
  for (const i of withPhotos) {
    const url = byPath.get(i.storage_path as string);
    if (url) byItem.set(i.id, url);
  }
  return byItem;
}

export interface GatheringClosetUse {
  id: string;
  quantity_planned: number | null;
  notes: string | null;
  item: {
    id: string;
    name: string;
    category: string | null;
    quantity_owned: number | null;
  } | null;
}

/**
 * What this gathering is using from the host's Hosting Closet.
 *
 * REFERENCE, NEVER TRANSFER. `gathering_closet_items` records that a
 * gathering is drawing on an account-level item; the item itself stays
 * in the closet and remains available to every future gathering. That
 * row is also the PROVENANCE behind a reduced shopping quantity — the
 * reason the list says "buy 4" instead of "buy 12".
 *
 * A CO-HOST SEES THIS AND NOT THE REST OF THE CLOSET. The SELECT policy
 * on hosting_closet_items grants an accepted member only the items
 * attached to a gathering they share, so this join returns the six
 * platters in use and nothing else the host owns. That boundary is in
 * the database, not in this query.
 */
export async function getGatheringClosetUse(
  gatheringId: string
): Promise<GatheringClosetUse[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_closet_items")
    .select(
      "id, quantity_planned, notes, item:hosting_closet_items(id, name, category, quantity_owned)"
    )
    .eq("gathering_id", gatheringId);
  if (error) return [];
  return (data ?? []) as unknown as GatheringClosetUse[];
}

/* ------------------------------------------------------------------ */
/* Smart Closet entitlement                                           */
/* ------------------------------------------------------------------ */

/**
 * Whether the SMART Closet layer is available for one gathering.
 *
 * THE TWO QUESTIONS ARE NOT THE SAME QUESTION, which is the correction
 * this whole sweep turns on:
 *
 *   "May I use My Hosting Closet?"   always yes for a signed-in account
 *   "May Place & Plenty work out      a Gathering Pass bound to THIS
 *    what I still need?"              gathering, or account Plus
 *
 * So this is gathering-scoped and takes a gathering id. There is no
 * account-level version of the second question that a Pass can answer,
 * because a Pass is not an account capability — see
 * gathering_can_access_smart_closet() in the database.
 *
 * A co-host of a Pass gathering gets `true` here, and gets no
 * account-level Plus anywhere else. That is deliberate.
 */
export async function gatheringHasSmartCloset(
  gatheringId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "gathering_can_access_smart_closet",
    { p_gathering_id: gatheringId }
  );
  // Fail closed. Showing a locked state to someone who has paid is a
  // support ticket; showing an unlocked one to someone who has not is a
  // broken promise when they tap it.
  if (error) return false;
  return data === true;
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

/* ------------------------------------------------------------------ */
/* The look & the day                                                 */
/* ------------------------------------------------------------------ */

export interface StyleBoard {
  id: string;
  theme: string | null;
  palette: unknown;
  mood_descriptors: string[] | null;
  vision_notes: string | null;
}

export interface StyleImage {
  id: string;
  storage_path: string | null;
  caption: string | null;
}

export interface StyleComponent {
  id: string;
  component_name: string | null;
  component_type: string | null;
  descriptor: string | null;
  search_terms: string | null;
}

/**
 * My Style Board. gathering_style is one row per gathering, so
 * maybeSingle() is correct — a gathering with no board yet returns null
 * rather than an empty array to interpret.
 */
export async function getStyleBoard(gatheringId: string): Promise<{
  board: StyleBoard | null;
  images: StyleImage[];
  components: StyleComponent[];
}> {
  const supabase = createClient();

  const [boardRes, imagesRes, componentsRes] = await Promise.all([
    supabase
      .from("gathering_style")
      .select("id, theme, palette, mood_descriptors, vision_notes")
      .eq("gathering_id", gatheringId)
      .maybeSingle(),
    supabase
      .from("gathering_style_images")
      .select("id, storage_path, caption")
      .eq("gathering_id", gatheringId)
      .order("display_order", { ascending: true }),
    supabase
      .from("gathering_style_components")
      .select("id, component_name, component_type, descriptor, search_terms")
      .eq("gathering_id", gatheringId),
  ]);

  if (boardRes.error) throw boardRes.error;

  return {
    board: (boardRes.data as StyleBoard) ?? null,
    // Images and components are supporting detail: a failure to read
    // them should not blank the board itself.
    images: (imagesRes.data ?? []) as StyleImage[],
    components: (componentsRes.data ?? []) as StyleComponent[],
  };
}

export interface MusicMedia {
  id: string;
  music_styles: string[] | null;
  playlist_url: string | null;
  moments_notes: string | null;
  explicit_allowed: boolean | null;
  must_play_notes: string | null;
  do_not_play_notes: string | null;
  special_songs_notes: string | null;
  audio_needs: string[] | null;
  visual_needs: string[] | null;
}

export async function getMusicMedia(
  gatheringId: string
): Promise<MusicMedia | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_music_media")
    .select(
      "id, music_styles, playlist_url, moments_notes, explicit_allowed, must_play_notes, do_not_play_notes, special_songs_notes, audio_needs, visual_needs"
    )
    .eq("gathering_id", gatheringId)
    .maybeSingle();
  if (error) throw error;
  return (data as MusicMedia) ?? null;
}

export interface SongRequest {
  id: string;
  song_title: string;
  artist: string | null;
  created_at: string;
}

/** Guest song requests for this gathering. */
export async function getSongRequests(
  gatheringId: string
): Promise<SongRequest[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guest_song_requests")
    .select("id, song_title, artist, created_at")
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: false });
  // The table has RLS and may not grant a host read on every project
  // state; a failure here should not take down the page.
  if (error) return [];
  return (data ?? []) as SongRequest[];
}

export interface GatheringPhoto {
  id: string;
  storage_path: string;
  caption: string | null;
  hidden_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * My Gathering Photos.
 *
 * NOTE ON WHAT IS AND IS NOT RETURNED. The table stores
 * uploaded_by_guest_id, but guest_gallery_by_token deliberately does not
 * expose contributor names to other guests — being named was never the
 * contributor's choice. A HOST legitimately needs attribution to
 * moderate, so the column exists; it is simply not selected here,
 * because this surface only lists and links photos and has no moderation
 * controls yet. Add it when moderation is built, not before.
 */
export async function getGatheringPhotos(
  gatheringId: string
): Promise<GatheringPhoto[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gathering_photos")
    .select("id, storage_path, caption, hidden_at, expires_at, created_at")
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as GatheringPhoto[];
}

export interface HelpTask {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_at: string | null;
  description: string | null;
  assigned_to_user_id: string | null;
  assigned_to_guest_id: string | null;
}

/**
 * Find Help — "where would an extra pair of hands actually change the
 * day". Backed by tasks: the ones still open and marked critical or
 * important are precisely the ones worth handing to someone.
 */
export async function getHelpCandidates(
  gatheringId: string
): Promise<HelpTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, description, assigned_to_user_id, assigned_to_guest_id"
    )
    .eq("gathering_id", gatheringId)
    .in("status", ["not_started", "in_progress", "blocked"])
    .order("priority", { ascending: true });
  if (error) return [];
  return (data ?? []) as HelpTask[];
}

/* ------------------------------------------------------------------ */
/* Invitation artwork                                                 */
/* ------------------------------------------------------------------ */

/**
 * Signed URLs for a batch of invitation artwork paths.
 *
 * THE BUCKET IS PRIVATE, so a stored path is not something a browser can
 * load. Signing happens on the server, per request, for exactly the
 * paths a page is about to render — never by making the bucket public,
 * which would put every host's invitation artwork on a guessable URL.
 *
 * ONE ROUND TRIP FOR THE WHOLE LIST. `createSignedUrls` takes an array,
 * which matters on the Host Home: signing eight gatherings one at a time
 * is eight sequential network calls before anything renders.
 *
 * PDF ARTWORK IS DELIBERATELY NOT SIGNED. The bucket accepts
 * application/pdf, and a PDF cannot render in an <img> — a signed URL
 * for one produces a broken image rather than an identity. Those fall
 * through to the designed plate, which is the honest result.
 *
 * An hour is long enough for a page view and short enough that a URL
 * copied out of devtools stops working the same afternoon.
 */
const ARTWORK_TTL_SECONDS = 3600;

export async function signArtwork(
  gatherings: Pick<
    GatheringSummary,
    "id" | "invitation_artwork_path" | "invitation_artwork_mime_type"
  >[]
): Promise<Map<string, string>> {
  const renderable = gatherings.filter(
    (g) =>
      g.invitation_artwork_path &&
      isRenderableArtwork(g.invitation_artwork_mime_type)
  );
  if (renderable.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(INVITATION_ARTWORK_BUCKET)
    .createSignedUrls(
      renderable.map((g) => g.invitation_artwork_path as string),
      ARTWORK_TTL_SECONDS
    );

  // A failure here costs a picture, not a page. Every surface falls back
  // to the designed identity plate.
  if (error || !data) return new Map();

  const byPath = new Map<string, string>();
  for (const row of data) {
    if (row.signedUrl && row.path) byPath.set(row.path, row.signedUrl);
  }

  const byGathering = new Map<string, string>();
  for (const g of renderable) {
    const url = byPath.get(g.invitation_artwork_path as string);
    if (url) byGathering.set(g.id, url);
  }
  return byGathering;
}
