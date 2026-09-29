export type PaperRetailPrice = {
  gelatoCostCents: number;
  retailSubtotalCents: number;
  marginCents: number;
  testModeAtCost: boolean;
};

export const APPROVED_PAPER_SUITE_PRICING = {
  markupPercent: 40,
  minimumMarginCents: 600,
  roundTo99: true,
} as const;

function paymentKey() {
  return process.env.PAYMENT_PROCESSOR_SECRET_KEY?.trim() || "";
}

function configuredNumber(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUpTo99(cents: number) {
  if (cents <= 0) return 99;
  if (cents % 100 === 99) return cents;
  return Math.floor(cents / 100) * 100 + 99;
}

export function paperRetailPrice(gelatoCostCents: number): PaperRetailPrice {
  if (!Number.isInteger(gelatoCostCents) || gelatoCostCents < 0) {
    throw new Error("invalid_gelato_cost");
  }

  // Sandbox checkout stays at quoted fulfillment cost so commerce plumbing can
  // be tested without creating artificial margin in Stripe test mode.
  if (paymentKey().startsWith("sk_test_")) {
    return {
      gelatoCostCents,
      retailSubtotalCents: Math.max(gelatoCostCents, 50),
      marginCents: Math.max(0, 50 - gelatoCostCents),
      testModeAtCost: true,
    };
  }

  // Approved V1 Paper Suite retail model:
  // - 40% markup over the current Gelato print + shipping quote
  // - at least $6.00 gross margin per physical order
  // - customer-facing subtotal rounded up to a .99 ending
  // Environment variables remain available as an emergency override without
  // changing the approved defaults in source control.
  const markup = configuredNumber(
    "PAPER_SUITE_MARKUP_PERCENT",
    APPROVED_PAPER_SUITE_PRICING.markupPercent
  );
  const minMargin = Math.round(
    configuredNumber(
      "PAPER_SUITE_MIN_MARGIN_CENTS",
      APPROVED_PAPER_SUITE_PRICING.minimumMarginCents
    )
  );

  const byMarkup = Math.ceil(gelatoCostCents * (1 + markup / 100));
  const marginFloor = gelatoCostCents + minMargin;
  let retailSubtotalCents = Math.max(byMarkup, marginFloor, 50);

  if (APPROVED_PAPER_SUITE_PRICING.roundTo99) {
    retailSubtotalCents = roundUpTo99(retailSubtotalCents);
  }

  return {
    gelatoCostCents,
    retailSubtotalCents,
    marginCents: retailSubtotalCents - gelatoCostCents,
    testModeAtCost: false,
  };
}
