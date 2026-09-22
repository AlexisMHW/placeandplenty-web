type QuoteProduct = {
  price?: number;
  priceInclVat?: number;
  currency?: string;
};

type ShipmentMethod = {
  shipmentMethodUid?: string;
  uid?: string;
  name?: string;
  price?: number;
  currency?: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  minDeliveryDate?: string;
  maxDeliveryDate?: string;
};

export type NormalizedGelatoQuote = {
  gelatoCostCents: number;
  productCostCents: number;
  shippingCostCents: number;
  shipmentMethodUid: string | null;
  shipmentMethodName: string | null;
  currency: string;
  deliveryLabel: string | null;
};

function dollarsToCents(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

export function normalizeGelatoQuote(raw: Record<string, unknown>): NormalizedGelatoQuote {
  const rawQuotes = raw.quotes;
  const quotes = Array.isArray(rawQuotes)
    ? rawQuotes
    : rawQuotes && typeof rawQuotes === "object"
      ? [rawQuotes]
      : [];

  const quote = (quotes[0] || raw) as Record<string, unknown>;
  const products = Array.isArray(quote.products) ? (quote.products as QuoteProduct[]) : [];
  const productCostCents = products.reduce(
    (sum, product) => sum + dollarsToCents(product.price ?? product.priceInclVat),
    0
  );

  const methods = Array.isArray(quote.shipmentMethods)
    ? (quote.shipmentMethods as ShipmentMethod[])
    : [];

  const cheapest = methods
    .filter((method) => Number.isFinite(Number(method.price)))
    .sort((a, b) => Number(a.price) - Number(b.price))[0] || null;

  const shippingCostCents = cheapest ? dollarsToCents(cheapest.price) : 0;
  const currency =
    String(
      cheapest?.currency ||
        products.find((product) => product.currency)?.currency ||
        raw.currency ||
        "USD"
    ).toUpperCase();

  if (productCostCents <= 0) {
    throw new Error("gelato_quote_missing_product_price");
  }

  const deliveryLabel = cheapest
    ? cheapest.minDeliveryDate && cheapest.maxDeliveryDate
      ? cheapest.minDeliveryDate + " – " + cheapest.maxDeliveryDate
      : Number.isFinite(Number(cheapest.minDeliveryDays)) &&
          Number.isFinite(Number(cheapest.maxDeliveryDays))
        ? String(cheapest.minDeliveryDays) + "–" + String(cheapest.maxDeliveryDays) + " days"
        : null
    : null;

  return {
    gelatoCostCents: productCostCents + shippingCostCents,
    productCostCents,
    shippingCostCents,
    shipmentMethodUid: cheapest
      ? String(cheapest.shipmentMethodUid || cheapest.uid || "") || null
      : null,
    shipmentMethodName: cheapest?.name ? String(cheapest.name) : null,
    currency,
    deliveryLabel,
  };
}
