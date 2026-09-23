import { NextResponse } from "next/server";
import { searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function inspectTail(catalogUid: string) {
  const unique = new Map<string, unknown>();
  let scanned = 0;
  for (const offset of [500, 600, 700, 800, 900, 1000, 1100, 1200]) {
    const response = await searchGelatoProducts(catalogUid, { limit: 100, offset });
    const products = response.products || [];
    scanned += products.length;
    for (const p of products) {
      const format = String(p.attributes?.PaperFormat || p.attributes?.Format || "");
      const orientation = String(p.attributes?.Orientation || "");
      const width = p.dimensions?.Width?.value ?? null;
      const height = p.dimensions?.Height?.value ?? null;
      const unit = p.dimensions?.Width?.measureUnit || p.dimensions?.Height?.measureUnit || null;
      const key = format + "|" + orientation;
      if (!unique.has(key)) unique.set(key, { format, orientation, width, height, unit });
    }
    if (products.length < 100) break;
  }
  return { catalogUid, scanned, formats: Array.from(unique.values()) };
}

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      cardsTail: await inspectTail("cards"),
      postersTail: await inspectTail("posters"),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
