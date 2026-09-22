import { createClient } from "@/lib/supabase-server";

export type PaperOrderSummary = {
  id: string;
  status: string;
  piece_type: string;
  size_id: string;
  quantity: number;
  currency: string;
  retail_subtotal_cents: number;
  gelato_order_id: string | null;
  gelato_order_type: string | null;
  created_at: string;
  paid_at: string | null;
  submitted_at: string | null;
};

export async function getPaperOrders(gatheringId: string): Promise<PaperOrderSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("paper_orders")
    .select(
      "id,status,piece_type,size_id,quantity,currency,retail_subtotal_cents,gelato_order_id,gelato_order_type,created_at,paid_at,submitted_at"
    )
    .eq("gathering_id", gatheringId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw error;
  return (data ?? []) as PaperOrderSummary[];
}
