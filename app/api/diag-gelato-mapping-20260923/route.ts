import { NextResponse } from "next/server";
import { searchGelatoProducts } from "@/lib/gelato";
import { PAPER_SIZES, type PaperSizeId } from "@/lib/paper-suite-catalog";
import {
  gelatoCatalog,
  gelatoPaperFormat,
  gelatoProductMatchesSize,
  gelatoSupportedQuantities,
} from "@/lib/paper-suite-gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = [];
    for (const size of Object.keys(PAPER_SIZES) as PaperSizeId[]) {
      const catalog = gelatoCatalog(size);
      const format = gelatoPaperFormat(size);
      const response = await searchGelatoProducts(catalog, {
        attributeFilters: { PaperFormat: [format] },
        limit: 100,
        offset: 0,
      });
      const matches = (response.products || []).filter((p) => gelatoProductMatchesSize(p, size));
      const first = matches[0] || null;
      results.push({
        size,
        catalog,
        format,
        returned: response.products?.length || 0,
        matched: matches.length,
        productUid: first?.productUid || null,
        quantities: first ? await gelatoSupportedQuantities(first.productUid) : [],
      });
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 502 });
  }
}
