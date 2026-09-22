export type PaperRetailPrice = {
  gelatoCostCents: number;
  retailSubtotalCents: number;
  marginCents: number;
  testModeAtCost: boolean;
};

function paymentKey() {
  return process.env.PAYMENT_PROCESSOR_SECRET_KEY?.trim() || "";
}

export function paperRetailPrice(gelatoCostCents: number): PaperRetailPrice {
  if (!Number.isInteger(gelatoCostCents) || gelatoCostCents < 0) {
    throw new Error("invalid_gelato_cost");
  }

  // Sandbox checkout is intentionally allowed at cost so the full payment
  // plumbing can be verified before the business locks a retail margin.
  if (paymentKey().startsWith("sk_test_")) {
    return {
      gelatoCostCents,
      retailSubtotalCents: Math.max(gelatoCostCents, 50),
      marginCents: Math.max(0, 50 - gelatoCostCents),
      testModeAtCost: true,
    };
  }

  const markup = Number(process.env.PAPER_SUITE_MARKUP_PERCENT);
  if (!Number.isFinite(markup) || markup < 0) {
    throw new Error("paper_suite_pricing_not_configured");
  }

  const minMargin = Number(process.env.PAPER_SUITE_MIN_MARGIN_CENTS || "0");
  const safeMinMargin = Number.isFinite(minMargin) && minMargin >= 0 ? Math.round(minMargin) : 0;
  const byMarkup = Math.ceil(gelatoCostCents * (1 + markup / 100));
  const retailSubtotalCents = Math.max(byMarkup, gelatoCostCents + safeMinMargin, 50);

  return {
    gelatoCostCents,
    retailSubtotalCents,
    marginCents: retailSubtotalCents - gelatoCostCents,
    testModeAtCost: false,
  };
}
