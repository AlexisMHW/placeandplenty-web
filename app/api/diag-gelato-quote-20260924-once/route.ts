import { NextResponse } from "next/server";
import { quoteGelatoOrder } from "@/lib/gelato";
import { normalizeGelatoQuote } from "@/lib/paper-suite-commerce";
import {
  encodePaperPayload,
  signPaperPayload,
  type PaperPrintPayload,
} from "@/lib/paper-suite-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

export async function GET() {
  const expiresAt = Date.now() + 1000 * 60 * 60;
  const payload: PaperPrintPayload = {
    version: 2,
    kind: "invitation",
    size: "5x7",
    template: "classic-editorial",
    gatheringName: "Harding Family Reunion",
    dateLabel: "October 10, 2026",
    timeLabel: "1:00 PM",
    locationName: "Nashville, Tennessee",
    bodyCopy: null,
    palette: null,
    expiresAt,
  };

  const encoded = encodePaperPayload(payload);
  const signature = signPaperPayload(encoded);
  const printFileUrl =
    siteUrl() +
    "/api/paper-suite/print/render?p=" +
    encodeURIComponent(encoded) +
    "&s=" +
    encodeURIComponent(signature);

  const productUid = "cards_pf_5r_pt_100-lb-cover-uncoated_cl_4-0_ver";
  const quantity = 10;

  try {
    const raw = await quoteGelatoOrder({
      orderReferenceId: "pp-gelato-quote-smoke-20260924",
      customerReferenceId: "pp-internal-quote-smoke",
      currency: "USD",
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
      products: [
        {
          itemReferenceId: "quote-item-1",
          productUid,
          quantity,
          files: [{ type: "default", url: printFileUrl }],
        },
      ],
      allowMultipleQuotes: true,
    });

    const normalized = normalizeGelatoQuote(raw);

    return NextResponse.json({
      ok: true,
      productUid,
      quantity,
      printFileUrl,
      normalized,
      raw,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "quote_failed",
        details:
          error && typeof error === "object" && "details" in error
            ? (error as { details: unknown }).details
            : null,
      },
      { status: 502 }
    );
  }
}
