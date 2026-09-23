import { NextResponse } from "next/server";
import { searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await searchGelatoProducts("cards", { limit: 100, offset: 0 });
    const seen = new Map<string, unknown>();
    for (const p of response.products || []) {
      const format = String(p.attributes?.PaperFormat || "");
      const orientation = String(p.attributes?.Orientation || "");
      const key = format + "|" + orientation;
      if (!seen.has(key)) {
        seen.set(key, {
          format,
          orientation,
          dimensions: p.dimensions,
          productUid: p.productUid,
        });
      }
    }
    return NextResponse.json({ ok: true, count: response.products?.length || 0, formats: Array.from(seen.values()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
