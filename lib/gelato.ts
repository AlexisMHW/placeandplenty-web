const ORDER_BASE = "https://order.gelatoapis.com/v4";
const PRODUCT_BASE = "https://product.gelatoapis.com/v3";

export class GelatoApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "GelatoApiError";
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.GELATO_API_KEY?.trim();
  if (!key) throw new Error("gelato_not_configured");
  return key;
}

async function gelatoFetch<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "X-API-KEY": apiKey(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    throw new GelatoApiError(
      "Gelato request failed with status " + response.status,
      response.status,
      body
    );
  }

  return body as T;
}

export type GelatoCatalog = {
  catalogUid: string;
  title: string;
};

export type GelatoProduct = {
  productUid: string;
  attributes: Record<string, string | number>;
  weight?: { value: number; measureUnit: string };
  dimensions?: Record<string, { value: number; measureUnit: string }>;
  supportedCountries?: string[];
  notSupportedCountries?: string[];
  isStockable?: boolean;
  isPrintable?: boolean;
  validPageCounts?: number[];
};

export type GelatoProductSearchResponse = {
  products: GelatoProduct[];
  hits?: Record<string, unknown>;
};

export async function listGelatoCatalogs(): Promise<GelatoCatalog[]> {
  return gelatoFetch<GelatoCatalog[]>(PRODUCT_BASE + "/catalogs");
}

export async function getGelatoCatalog(catalogUid: string) {
  return gelatoFetch<Record<string, unknown>>(
    PRODUCT_BASE + "/catalogs/" + encodeURIComponent(catalogUid)
  );
}

export async function searchGelatoProducts(
  catalogUid: string,
  input: {
    attributeFilters?: Record<string, string[]>;
    limit?: number;
    offset?: number;
  } = {}
): Promise<GelatoProductSearchResponse> {
  return gelatoFetch<GelatoProductSearchResponse>(
    PRODUCT_BASE +
      "/catalogs/" +
      encodeURIComponent(catalogUid) +
      "/products:search",
    {
      method: "POST",
      body: JSON.stringify({
        attributeFilters: input.attributeFilters || {},
        limit: Math.min(Math.max(input.limit || 100, 1), 100),
        offset: Math.max(input.offset || 0, 0),
      }),
    }
  );
}

export async function getGelatoProduct(productUid: string) {
  return gelatoFetch<GelatoProduct>(
    PRODUCT_BASE + "/products/" + encodeURIComponent(productUid)
  );
}

export async function getGelatoProductPrices(
  productUid: string,
  params: { country?: string; currency?: string; pageCount?: number } = {}
) {
  const query = new URLSearchParams();
  if (params.country) query.set("country", params.country);
  if (params.currency) query.set("currency", params.currency);
  if (params.pageCount != null) query.set("pageCount", String(params.pageCount));

  return gelatoFetch<
    Array<{
      productUid: string;
      country: string;
      quantity: number;
      price: number;
      currency: string;
      pageCount: number | null;
    }>
  >(
    PRODUCT_BASE +
      "/products/" +
      encodeURIComponent(productUid) +
      "/prices" +
      (query.size ? "?" + query.toString() : "")
  );
}

export type GelatoRecipient = {
  country: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  state?: string;
  email: string;
  phone?: string;
};

export type GelatoPrintFile = {
  type?: "default" | "back" | "inside";
  url: string;
};

export type GelatoOrderProduct = {
  itemReferenceId: string;
  productUid: string;
  files: GelatoPrintFile[];
  quantity: number;
  pageCount?: number;
};

export type GelatoQuoteRequest = {
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  recipient: GelatoRecipient;
  products: GelatoOrderProduct[];
  allowMultipleQuotes?: boolean;
};

export async function quoteGelatoOrder(input: GelatoQuoteRequest) {
  return gelatoFetch<Record<string, unknown>>(ORDER_BASE + "/orders:quote", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type GelatoCreateOrderRequest = {
  orderType?: "draft" | "order";
  orderReferenceId: string;
  customerReferenceId: string;
  currency: string;
  items: GelatoOrderProduct[];
  shippingAddress: GelatoRecipient;
  shipmentMethodUid?: string;
  metadata?: Array<{ key: string; value: string }>;
};

export async function createGelatoOrder(input: GelatoCreateOrderRequest) {
  return gelatoFetch<Record<string, unknown>>(ORDER_BASE + "/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getGelatoOrder(orderId: string) {
  return gelatoFetch<Record<string, unknown>>(
    ORDER_BASE + "/orders/" + encodeURIComponent(orderId)
  );
}
