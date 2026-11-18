import { requireStaff } from "@/lib/admin/server";
import { historyCsv, ledgerCsv } from "@/lib/admin/csv-export";
import { parseHistory, parseLedger } from "@/lib/admin/payout-ledger";

// CSV export of the payout ledger or history. READ ONLY. Needs hc.payout (owner and authorized financial staff); anyone else gets a 404 exactly like the page.
// The data comes from the same permission-checked database functions as the page, called as the signed-in staff member (no service-role key). Nothing is written.
export const dynamic = "force-dynamic";
const HEADERS = (name: string) => ({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  const { supabase } = await requireStaff("hc.payout", "/command-center/hosting-collective/payouts");
  if (kind !== "ledger" && kind !== "history") return new Response("kind must be ledger or history", { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const asOf = new Date().toISOString();
  const day = asOf.slice(0, 10);
  const ledgerRes = await supabase.rpc("hc_admin_payout_ledger");
  const ledger = ledgerRes.error ? null : parseLedger(ledgerRes.data);
  if (!ledger) return new Response("Not available", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  if (kind === "ledger") return new Response(ledgerCsv(ledger, asOf), { headers: HEADERS(`hc-ledger-${day}.csv`) });
  const histRes = await supabase.rpc("hc_admin_payout_history", { p_partner_id: null, p_limit: 500 });
  const history = histRes.error ? null : parseHistory(histRes.data);
  if (!history) return new Response("Not available", { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return new Response(historyCsv(history, new Map(ledger.partners.map((p) => [p.partnerId, p.displayName] as const)), asOf), { headers: HEADERS(`hc-payout-history-${day}.csv`) });
}
