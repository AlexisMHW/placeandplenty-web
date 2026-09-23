import { NextResponse } from "next/server";
import { searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function inspect(catalogUid: string) {
  const response = await searchGelatoProducts(catalogUid, { limit: 100, offset: 0 });
  const seen = new Map<string, unknown>();
  for (const p of response.products || []) {
    const format = String(p.attributes?.PaperFormat || p.attributes?.Format || "");
    const orientation = String(p.attributes?.Orientation || "");
    const width = p.dimensions?.Width?.value ?? null;
    const height = p.dimensions?.Height?.value ?? null;
    const unit = p.dimensions?.Width?.measureUnit || p.dimensions?.Height?.measureUnit || null;
    const key = format + "|" + orientation;
    if (!seen.has(key)) {
      seen.set(key, {
        format,
        orientation,
        width,
        height,
        unit,
        productUid: p.productUid,
        color: p.attributes?.ColorType || null,
        paper: p.attributes?.PaperType || null,
      });
    }
  }
  return { catalogUid, count: response.products?.length || 0, formats: Array.from(seen.values()) };
}

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      cardsUs: await inspect("cards-us"),
      cards: await inspect("cards"),
      posters: await inspect("posters"),
      flyers: await inspect("flyers"),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
