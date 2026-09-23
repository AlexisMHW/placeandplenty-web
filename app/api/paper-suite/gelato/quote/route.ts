import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getGathering } from "@/lib/host-data";
import { quoteGelatoOrder, type GelatoQuoteRequest } from "@/lib/gelato";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";
import { paperRetailPrice } from "@/lib/paper-suite-pricing";
import { paperSize, type PaperSizeId } from "@/lib/paper-suite-catalog";

export const runtime = "nodejs";

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
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
    !validHttpsUrl(body.fileUrl)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const gathering = await getGathering(body.gatheringId);
  if (!gathering) return NextResponse.json({ error: "gathering_not_found" }, { status: 404 });

  const posterLike = body.size === "8x10" || body.size === "a4";
  const minQuantity = posterLike ? 1 : 10;
  const maxQuantity = posterLike ? 100 : 500;
  const quantity = Math.max(
    minQuantity,
    Math.min(Number(body.quantity) || minQuantity, maxQuantity)
  );
  const orderReferenceId = "paper-quote-" + body.gatheringId + "-" + Date.now();

  try {
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
