import { NextRequest, NextResponse } from "next/server";
import {
  listGelatoCatalogs,
  searchGelatoProducts,
  quoteGelatoOrder,
  type GelatoProduct,
} from "@/lib/gelato";
import {
  encodePaperPayload,
  signPaperPayload,
  type PaperPrintPayload,
} from "@/lib/paper-suite-print";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QA_TOKEN = "pp-gelato-smoke-9f4c7a8d3b26";
const QA_EXPIRES_AT = Date.parse("2026-09-23T17:10:00Z");

function searchable(product: GelatoProduct) {
  return Object.entries(product.attributes || {})
    .filter(([key]) => /format|size|dimension|paper|orientation|status/i.test(key))
    .map(([key, value]) => key + "=" + String(value))
    .join(" ");
}

function looksLikeFiveBySeven(product: GelatoProduct) {
  const s = searchable(product).toLowerCase();
  return (
    s.includes("5x7") ||
    s.includes("5 x 7") ||
    s.includes("13x18") ||
    s.includes("13 x 18") ||
    s.includes("5r")
  );
}

function usableInUS(product: GelatoProduct) {
  return !product.supportedCountries || product.supportedCountries.includes("US");
}

export async function GET(req: NextRequest) {
  const supplied = req.nextUrl.searchParams.get("token");
  if (supplied !== QA_TOKEN || Date.now() > QA_EXPIRES_AT) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const startedAt = Date.now();

  try {
    const catalogsRaw = (await listGelatoCatalogs()) as unknown;
    if (!Array.isArray(catalogsRaw)) {
      return NextResponse.json({
        ok: false,
        stage: "catalog_shape",
        elapsedMs: Date.now() - startedAt,
        rawType: typeof catalogsRaw,
        raw: catalogsRaw,
      });
    }
    const catalogs = catalogsRaw;
    const cardsCatalog =
      catalogs.find((c: any) => c.catalogUid === "cards") ||
      catalogs.find((c: any) => /card/i.test(String(c.catalogUid || "") + " " + String(c.title || "")));

    if (!cardsCatalog) {
      return NextResponse.json({
        ok: false,
        stage: "catalogs",
        elapsedMs: Date.now() - startedAt,
        catalogs,
        error: "cards_catalog_not_found",
      });
    }

    const search = await searchGelatoProducts(cardsCatalog.catalogUid, {
      limit: 100,
      offset: 0,
    });

    const products = (search.products || []).filter(usableInUS);
    const fiveBySeven = products.filter(looksLikeFiveBySeven);
    const candidates = fiveBySeven.length ? fiveBySeven : products.slice(0, 12);

    const payload: PaperPrintPayload = {
      version: 2,
      kind: "invitation",
      size: "5x7",
      template: "classic-editorial",
      gatheringName: "Place & Plenty Gelato QA",
      dateLabel: "Saturday, October 10",
      timeLabel: "1:00 PM",
      locationName: "Nashville, Tennessee",
      bodyCopy: "Print-pipeline diagnostic. Do not fulfill.",
      palette: null,
      expiresAt: Date.now() + 1000 * 60 * 30,
    };

    const encoded = encodePaperPayload(payload);
    const signature = signPaperPayload(encoded);
    const printUrl =
      req.nextUrl.origin +
      "/api/paper-suite/print/render?p=" +
      encodeURIComponent(encoded) +
      "&s=" +
      encodeURIComponent(signature);

    const renderCheck = await fetch(printUrl, { cache: "no-store" });
    const renderType = renderCheck.headers.get("content-type");
    const renderBytes = (await renderCheck.arrayBuffer()).byteLength;

    const quoteAttempts: Array<Record<string, unknown>> = [];
    let successfulQuote: Record<string, unknown> | null = null;
    let successfulProduct: GelatoProduct | null = null;
    let normalized: ReturnType<typeof normalizeGelatoQuote> | null = null;

    for (const product of candidates.slice(0, 12)) {
      try {
        const rawQuote = await quoteGelatoOrder({
          orderReferenceId: "pp-gelato-smoke-" + Date.now(),
          customerReferenceId: "place-and-plenty-qa",
          currency: "USD",
          allowMultipleQuotes: false,
          recipient: {
            country: "US",
            firstName: "Place",
            lastName: "Plenty",
            addressLine1: "350 5th Ave",
            city: "New York",
            postCode: "10118",
            state: "NY",
            email: "qa@example.com",
          },
          products: [
            {
              itemReferenceId: "qa-card-1",
              productUid: product.productUid,
              quantity: 25,
              files: [{ type: "default", url: printUrl }],
            },
          ],
        });

        successfulQuote = rawQuote;
        successfulProduct = product;
        normalized = normalizeGelatoQuote(rawQuote);
        quoteAttempts.push({ productUid: product.productUid, ok: true });
        break;
      } catch (error) {
        quoteAttempts.push({
          productUid: product.productUid,
          ok: false,
          message: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    return NextResponse.json({
      ok: Boolean(successfulQuote && normalized),
      stage: successfulQuote ? "quote" : "product_quote",
      elapsedMs: Date.now() - startedAt,
      gelato: {
        catalogCount: catalogs.length,
        catalogs: catalogs.map((c: any) => ({ catalogUid: c.catalogUid, title: c.title })),
        cardsCatalog: { catalogUid: cardsCatalog.catalogUid, title: cardsCatalog.title },
        searchProductCount: search.products?.length || 0,
        usProductCount: products.length,
        fiveBySevenCount: fiveBySeven.length,
        sampleCandidates: candidates.slice(0, 8).map((p) => ({
          productUid: p.productUid,
          attributes: p.attributes,
          supportedCountries: p.supportedCountries,
        })),
      },
      print: {
        urlGenerated: true,
        status: renderCheck.status,
        contentType: renderType,
        bytes: renderBytes,
      },
      quote: successfulQuote
        ? {
            productUid: successfulProduct?.productUid,
            productAttributes: successfulProduct?.attributes,
            normalized,
            raw: successfulQuote,
          }
        : null,
      quoteAttempts,
      safety: { createsOrder: false, chargesCard: false, temporary: true },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "fatal",
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
