import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getGathering } from "@/lib/host-data";
import { quoteGelatoOrder, type GelatoQuoteRequest } from "@/lib/gelato";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";
import { paperRetailPrice } from "@/lib/paper-suite-pricing";
import { paperSize, type PaperSizeId } from "@/lib/paper-suite-catalog";
import {
  validateGelatoProductForSize,
  validateGelatoQuantity,
} from "@/lib/paper-suite-gelato";

export const runtime = "nodejs";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

function validPrintUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const file = new URL(value);
    const site = new URL(siteUrl());
    return (
      file.protocol === "https:" &&
      file.origin === site.origin &&
      file.pathname === "/api/paper-suite/print/render"
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | {
        gatheringId?: string;
        size?: PaperSizeId;
        productUid?: string;
        quantity?: number;
        fileUrl?: string;
        recipient?: GelatoQuoteRequest["recipient"];
      }
    | null;

  if (
    !body?.gatheringId ||
    !body.size ||
    !paperSize(body.size) ||
    !body.productUid ||
    !body.recipient ||
    !validPrintUrl(body.fileUrl)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const gathering = await getGathering(body.gatheringId);
  if (!gathering) return NextResponse.json({ error: "gathering_not_found" }, { status: 404 });

  const quantity = Number(body.quantity);
  if (!Number.isInteger(quantity)) {
    return NextResponse.json({ error: "unsupported_gelato_quantity" }, { status: 400 });
  }

  try {
    const [validProduct, validQuantity] = await Promise.all([
      validateGelatoProductForSize(body.productUid, body.size),
      validateGelatoQuantity(body.productUid, quantity),
    ]);

    if (!validProduct) {
      return NextResponse.json({ error: "unsupported_gelato_product" }, { status: 400 });
    }
    if (!validQuantity) {
      return NextResponse.json({ error: "unsupported_gelato_quantity" }, { status: 400 });
    }

    const orderReferenceId = "paper-quote-" + body.gatheringId + "-" + Date.now();
    const quote = await quoteGelatoOrder({
      orderReferenceId,
      customerReferenceId: user.id,
      currency: "USD",
      allowMultipleQuotes: false,
      recipient: body.recipient,
      products: [
        {
          itemReferenceId: "paper-item-1",
          productUid: body.productUid,
          quantity,
          files: [{ type: "default", url: body.fileUrl }],
        },
      ],
    });

    const normalized = normalizeGelatoQuote(quote);
    let pricing: ReturnType<typeof paperRetailPrice> | null = null;
    try {
      pricing = paperRetailPrice(normalized.gelatoCostCents);
    } catch {
      pricing = null;
    }

    return NextResponse.json({ quote, normalized, pricing });
  } catch (error) {
    console.error("Gelato quote failed", error);
    return NextResponse.json({ error: "gelato_quote_failed" }, { status: 502 });
  }
}
