import { createClient } from "@/lib/supabase-server";

export interface BudgetSummaryWeb {
  budgetTarget: number | null;
  projected: number;
  spent: number;
  expenseTotal: number;
  spentIsOverridden: boolean;
  remaining: number | null;
  position: "no_budget_set" | "comfortable" | "workable" | "tight" | "over_budget";
  categories: Array<{ category: string; label?: string; projected: number; spent: number }>;
}

export interface ExpenseWithReceipt {
  id: string;
  amount: number;
  category: string | null;
  merchant: string | null;
  expense_date: string;
  note: string | null;
  receipt_url: string | null;
}

export async function getBudgetData(gatheringId: string): Promise<{
  summary: BudgetSummaryWeb;
  expenses: ExpenseWithReceipt[];
  premium: boolean;
}> {
  const supabase = createClient();
  const [summaryResult, expensesResult, premiumResult] = await Promise.all([
    supabase.rpc("get_budget_summary", { p_gathering_id: gatheringId }),
    supabase
      .from("gathering_expenses")
      .select("id, amount, category, merchant, expense_date, note, gathering_expense_receipts(storage_path)")
      .eq("gathering_id", gatheringId)
      .order("expense_date", { ascending: false }),
    supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId }),
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (expensesResult.error) throw expensesResult.error;

  const raw = (summaryResult.data ?? {}) as Record<string, unknown>;
  const summary: BudgetSummaryWeb = {
    budgetTarget: raw.budgetTarget == null ? null : Number(raw.budgetTarget),
    projected: Number(raw.projected ?? 0),
    spent: Number(raw.spent ?? 0),
    expenseTotal: Number(raw.expenseTotal ?? 0),
    spentIsOverridden: Boolean(raw.spentIsOverridden),
    remaining: raw.remaining == null ? null : Number(raw.remaining),
    position: (raw.position as BudgetSummaryWeb["position"]) ?? "no_budget_set",
    categories: ((raw.categories ?? []) as Array<Record<string, unknown>>).map((row) => ({
      category: String(row.category ?? "other"),
      label: row.label ? String(row.label) : undefined,
      projected: Number(row.projected ?? 0),
      spent: Number(row.spent ?? 0),
    })),
  };

  const expenses: ExpenseWithReceipt[] = await Promise.all(
    (expensesResult.data ?? []).map(async (row: any) => {
      const path = row.gathering_expense_receipts?.[0]?.storage_path ?? null;
      let receiptUrl: string | null = null;
      if (path) {
        const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
        receiptUrl = data?.signedUrl ?? null;
      }
      return {
        id: row.id,
        amount: Number(row.amount ?? 0),
        category: row.category,
        merchant: row.merchant,
        expense_date: row.expense_date,
        note: row.note,
        receipt_url: receiptUrl,
      };
    })
  );

  return { summary, expenses, premium: premiumResult.data === true };
}
