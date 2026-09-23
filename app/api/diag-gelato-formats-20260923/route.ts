import { NextResponse } from "next/server";
import { searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function inspectAll(catalogUid: string) {
  const unique = new Map<string, unknown>();
  let total = 0;
  for (const offset of [0, 100, 200, 300, 400]) {
    const response = await searchGelatoProducts(catalogUid, { limit: 100, offset });
    const products = response.products || [];
    total += products.length;
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
  return { catalogUid, scanned: total, formats: Array.from(unique.values()) };
}

export async function GET() {
  try {
    return NextResponse.json({
      ok: true,
      cards: await inspectAll("cards"),
      posters: await inspectAll("posters"),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
