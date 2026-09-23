import { NextResponse } from "next/server";
import {
  listGelatoCatalogs,
  searchGelatoProducts,
  getGelatoProductPrices,
  quoteGelatoOrder,
} from "@/lib/gelato";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalogs = await listGelatoCatalogs();
    const preferred =
      catalogs.find((c) => c.catalogUid === "cards") ||
      catalogs.find((c) => c.catalogUid === "stationery") ||
      catalogs.find((c) => /cards/i.test(c.catalogUid + " " + c.title)) ||
      catalogs[0];

    if (!preferred) {
      return NextResponse.json({ ok: false, stage: "catalogs", error: "no_catalogs" }, { status: 502 });
    }

    const found = await searchGelatoProducts(preferred.catalogUid, { limit: 25, offset: 0 });
    const printable = (found.products || []).filter((p) => p.isPrintable !== false);
    const product = printable[0] || found.products?.[0];

    if (!product) {
      return NextResponse.json({
        ok: false,
        stage: "products",
        catalog: { uid: preferred.catalogUid, title: preferred.title },
        productCount: 0,
      }, { status: 502 });
    }

    let prices: unknown = null;
    try {
      prices = await getGelatoProductPrices(product.productUid, { country: "US", currency: "USD" });
    } catch (error) {
      prices = { error: error instanceof Error ? error.message : "price_lookup_failed" };
    }

    let normalizedQuote: unknown = null;
    let quoteShape: unknown = null;
    try {
      const rawQuote = await quoteGelatoOrder({
        orderReferenceId: "pp-smoke-" + Date.now(),
        customerReferenceId: "pp-internal-smoke",
        currency: "USD",
        allowMultipleQuotes: false,
        recipient: {
          country: "US",
          firstName: "Place",
          lastName: "Plenty",
          addressLine1: "1 Public Square",
          city: "Nashville",
          postCode: "37201",
          state: "TN",
          email: "support@placeandplenty.com",
        },
        products: [{
          itemReferenceId: "smoke-item-1",
          productUid: product.productUid,
          quantity: 10,
          files: [{ type: "default", url: "https://placeandplenty.com/images/harding-paper-suite.webp" }],
        }],
      });
      normalizedQuote = normalizeGelatoQuote(rawQuote);
      quoteShape = {
        topLevelKeys: Object.keys(rawQuote),
        quoteCount: Array.isArray((rawQuote as Record<string, unknown>).quotes)
          ? ((rawQuote as Record<string, unknown>).quotes as unknown[]).length
          : null,
      };
    } catch (error) {
      normalizedQuote = { error: error instanceof Error ? error.message : "quote_failed" };
    }

    return NextResponse.json({
      ok: true,
      catalogCount: catalogs.length,
      catalogs: catalogs.slice(0, 12).map((c) => ({ uid: c.catalogUid, title: c.title })),
      selectedCatalog: { uid: preferred.catalogUid, title: preferred.title },
      productCount: found.products?.length || 0,
      sampleProducts: (found.products || []).slice(0, 12).map((p) => ({
        productUid: p.productUid,
        attributes: p.attributes,
        supportedCountries: p.supportedCountries,
        dimensions: p.dimensions,
      })),
      selectedProduct: {
        productUid: product.productUid,
        attributes: product.attributes,
        supportedCountries: product.supportedCountries,
        isPrintable: product.isPrintable,
        dimensions: product.dimensions,
      },
      prices,
      quoteShape,
      normalizedQuote,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "gelato_smoke_failed",
    }, { status: 502 });
  }
}
