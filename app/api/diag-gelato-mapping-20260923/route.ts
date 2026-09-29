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

function rankProduct(product: { productUid: string; attributes?: Record<string, string | number> }) {
  const attrs = product.attributes || {};
  const paperType = String(attrs.PaperType || attrs.UltimatePaperType || "");
  const coating = String(attrs.CoatingType || "none");
  const protection = String(attrs.ProtectionType || "none");

  let score = 0;
  if (/cover|300-gsm|110lb/i.test(paperType)) score += 40;
  if (/uncoated/i.test(paperType)) score += 24;
  if (/silk/i.test(paperType)) score += 18;
  if (/matt/i.test(coating) || /matt/i.test(protection)) score += 14;
  if (coating === "none") score += 10;
  if (protection === "none") score += 8;
  if (/100-lb|110-lb|120-lb|250-gsm|300-gsm|350-gsm/i.test(paperType)) score += 10;

  return { productUid: product.productUid, score, paperType, coating, protection };
}

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
      const ranked = (response.products || [])
        .filter((p) => gelatoProductMatchesSize(p, size))
        .map(rankProduct)
        .sort((a, b) => b.score - a.score || a.productUid.localeCompare(b.productUid))
        .slice(0, 5);

      const top = ranked[0] || null;
      results.push({
        size,
        catalog,
        format,
        matched: ranked.length,
        top,
        topQuantities: top ? await gelatoSupportedQuantities(top.productUid) : [],
        ranked,
      });
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 502 }
    );
  }
}
