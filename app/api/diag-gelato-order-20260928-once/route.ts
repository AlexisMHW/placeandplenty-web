import { NextResponse } from "next/server";
import { getGelatoOrder } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const id = "b37c19ee-a85f-4856-8d68-252952ef09b5";
  try {
    const order = await getGelatoOrder(id);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "gelato_order_lookup_failed",
        details:
          error && typeof error === "object" && "details" in error
            ? (error as { details: unknown }).details
            : null,
      },
      { status: 502 }
    );
  }
}
