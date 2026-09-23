import { NextResponse } from "next/server";
import { createGelatoOrder, getGelatoOrder } from "@/lib/gelato";
import { encodePaperPayload, signPaperPayload, type PaperPrintPayload } from "@/lib/paper-suite-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

export async function GET() {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
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
  const fileUrl =
    siteUrl() +
    "/api/paper-suite/print/render?p=" +
    encodeURIComponent(encoded) +
    "&s=" +
    encodeURIComponent(signature);

  try {
    const created = await createGelatoOrder({
      orderType: "draft",
      orderReferenceId: "pp-gelato-draft-smoke-20260923",
      customerReferenceId: "pp-internal-smoke",
      currency: "USD",
      items: [{
        itemReferenceId: "draft-item-1",
        productUid: "cards_pf_5r_pt_100-lb-cover-uncoated_cl_4-0_ver",
        quantity: 10,
        files: [{ type: "default", url: fileUrl }],
      }],
      shippingAddress: {
        country: "US",
        firstName: "Place",
        lastName: "Plenty",
        addressLine1: "1 Public Square",
        city: "Nashville",
        postCode: "37201",
        state: "TN",
        email: "support@placeandplenty.com",
      },
      shipmentMethodUid: "usps_ground_advantage",
      metadata: [
        { key: "source", value: "place_and_plenty_smoke_test" },
        { key: "purpose", value: "draft_only_no_production" },
      ],
    });

    const id =
      typeof created.id === "string"
        ? created.id
        : typeof created.orderId === "string"
          ? created.orderId
          : null;

    let fetched: unknown = null;
    if (id) {
      try {
        fetched = await getGelatoOrder(id);
      } catch (error) {
        fetched = { error: error instanceof Error ? error.message : "lookup_failed" };
      }
    }

    return NextResponse.json({
      ok: Boolean(id),
      orderTypeRequested: "draft",
      gelatoOrderId: id,
      created,
      fetched,
      printFileUrl: fileUrl,
      productUid: "cards_pf_5r_pt_100-lb-cover-uncoated_cl_4-0_ver",
      quantity: 10,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      orderTypeRequested: "draft",
      error: error instanceof Error ? error.message : "gelato_draft_failed",
      details: error && typeof error === "object" && "details" in error ? (error as {details: unknown}).details : null,
      printFileUrl: fileUrl,
    }, { status: 502 });
  }
}
