import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { searchGelatoProducts } from "@/lib/gelato";
import { paperSize, type PaperSizeId } from "@/lib/paper-suite-catalog";
import {
  gelatoCatalog,
  gelatoPaperFormat,
  gelatoProductMatchesSize,
  gelatoSupportedQuantities,
} from "@/lib/paper-suite-gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const requestedSize = (req.nextUrl.searchParams.get("size") || "") as PaperSizeId;
  if (!requestedSize || !paperSize(requestedSize)) {
    return NextResponse.json({ error: "unsupported_size" }, { status: 400 });
  }

  const catalog = gelatoCatalog(requestedSize);
  const format = gelatoPaperFormat(requestedSize);

  try {
    const response = await searchGelatoProducts(catalog, {
      attributeFilters: { PaperFormat: [format] },
      limit: 100,
      offset: 0,
    });

    const ranked = (response.products || [])
      .filter((product) => gelatoProductMatchesSize(product, requestedSize))
      .map((product) => {
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

        const finishLabel =
          /uncoated/i.test(paperType)
            ? "Uncoated"
            : /silk/i.test(paperType)
              ? "Silk"
              : /matt/i.test(coating) || /matt/i.test(protection)
                ? "Matte"
                : "Print";

        const weightLabel = paperType
          .replace(/-/g, " ")
          .replace(/cover/gi, "")
          .replace(/coated/gi, "")
          .replace(/uncoated/gi, "")
          .replace(/silk/gi, "")
          .replace(/gsm/gi, "gsm")
          .replace(/s+/g, " ")
          .trim();

        return {
          productUid: product.productUid,
          attributes: product.attributes,
          score,
          title: weightLabel ? finishLabel + " · " + weightLabel : finishLabel,
          finishLabel,
        };
      })
      .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const curated = ranked
      .filter((product) => {
        const key = product.finishLabel;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);

    const selected = curated.length > 0 ? curated : ranked.slice(0, 3);
    const candidates = await Promise.all(
      selected.map(async ({ score: _score, finishLabel: _finishLabel, ...product }) => ({
        ...product,
        quantities: await gelatoSupportedQuantities(product.productUid),
      }))
    );

    return NextResponse.json({
      catalog,
      size: requestedSize,
      format,
      candidates,
      curated: true,
      validatedMapping: true,
    });
  } catch (error) {
    console.error("Gelato product discovery failed", error);
    return NextResponse.json({ error: "gelato_product_discovery_failed" }, { status: 502 });
  }
}
