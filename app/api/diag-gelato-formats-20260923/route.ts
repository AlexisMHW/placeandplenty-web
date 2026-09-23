import { NextResponse } from "next/server";
import { listGelatoCatalogs, searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const catalogs = await listGelatoCatalogs();
    const related = catalogs.filter((c) =>
      /card|post|station|flyer|brochure|invite|greeting|poster/i.test(c.catalogUid + " " + c.title)
    );

    const inspected = [];
    for (const catalog of related.slice(0, 20)) {
      try {
        const response = await searchGelatoProducts(catalog.catalogUid, { limit: 100, offset: 0 });
        const seen = new Map<string, unknown>();
        for (const p of response.products || []) {
          const format = String(p.attributes?.PaperFormat || p.attributes?.Format || "");
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
        inspected.push({
          catalogUid: catalog.catalogUid,
          title: catalog.title,
          count: response.products?.length || 0,
          formats: Array.from(seen.values()),
        });
      } catch (error) {
        inspected.push({
          catalogUid: catalog.catalogUid,
          title: catalog.title,
          error: error instanceof Error ? error.message : "failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      relatedCatalogs: related,
      inspected,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
