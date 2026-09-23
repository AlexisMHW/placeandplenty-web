import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { searchGelatoProducts } from "@/lib/gelato";
import { paperSize, type PaperSizeId } from "@/lib/paper-suite-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATALOGS = new Set([
  "cards",
  "stationery",
  "stationery-business",
  "posters",
]);

const SIZE_TERMS: Record<PaperSizeId, string[]> = {
  "4x6": ["sm", "4.25x5.5", "4.25 x 5.5", "4 1/4", "10.8x14"],
  "5x7": ["5x7", "5 x 7", "13x18", "13 x 18", "5r"],
  "4x9": ["dl", "9.9x21", "9.9 x 21", "99x210", "99 x 210"],
  "square-5": ["sx", "5.25x5.25", "5.25 x 5.25", "square"],
  a5: ["a5"],
  "8x10": ["8x10", "8 x 10", "20x25", "20 x 25"],
  a4: ["a4"],
};

function matchesRequestedSize(
  attrs: Record<string, string | number>,
  size: PaperSizeId | null
) {
  if (!size) return true;

  const searchable = Object.entries(attrs)
    .filter(([key]) => /format|size|dimension|paper/i.test(key))
    .map(([, value]) => String(value).toLowerCase())
    .join(" ");

  if (!searchable) return true;
  return SIZE_TERMS[size].some((term) => searchable.includes(term));
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const catalog = req.nextUrl.searchParams.get("catalog") || "cards";
  if (!ALLOWED_CATALOGS.has(catalog)) {
    return NextResponse.json({ error: "unsupported_catalog" }, { status: 400 });
  }

  const requestedSize = (req.nextUrl.searchParams.get("size") || "") as PaperSizeId;
  const size = requestedSize && paperSize(requestedSize) ? requestedSize : null;

  try {
    const response = await searchGelatoProducts(catalog, { limit: 100, offset: 0 });

    const ranked = (response.products || [])
      .filter((product) => {
        const attrs = product.attributes || {};
        const orientation = String(attrs.Orientation || "").toLowerCase();
        const color = String(attrs.ColorType || "").toLowerCase();

        const portraitOrUnspecified =
          !orientation ||
          orientation === "ver" ||
          orientation === "portrait" ||
          (size === "square-5" && orientation.includes("square"));
        const printableColor = !color || color.includes("4-0") || color.includes("4-4");

        const status = String(attrs.ProductStatus || "").toLowerCase();
        const folding = String(attrs.FoldingType || "none").toLowerCase();
        const spot = String(attrs.SpotFinishingType || "none").toLowerCase();
        const supportsUS = !product.supportedCountries || product.supportedCountries.includes("US");

        return (
          portraitOrUnspecified &&
          printableColor &&
          matchesRequestedSize(attrs, size) &&
          (!status || status === "activated") &&
          (folding === "none" || folding === "") &&
          (spot === "none" || spot === "") &&
          supportsUS
        );
      })
      .map((product) => {
        const attrs = product.attributes || {};
        const paperType = String(attrs.PaperType || "");
        const coating = String(attrs.CoatingType || "none");
        const protection = String(attrs.ProtectionType || "none");

        let score = 0;
        if (/cover/i.test(paperType)) score += 40;
        if (/uncoated/i.test(paperType)) score += 22;
        if (/silk/i.test(paperType)) score += 18;
        if (/matt/i.test(coating) || /matt/i.test(protection)) score += 14;
        if (coating === "none") score += 10;
        if (protection === "none") score += 8;
        if (/100-lb|110-lb|120-lb|300|350/i.test(paperType)) score += 10;

        const finishLabel =
          /uncoated/i.test(paperType)
            ? "Uncoated"
            : /silk/i.test(paperType)
              ? "Silk"
              : /matt/i.test(coating) || /matt/i.test(protection)
                ? "Matte"
                : "Print";

        const weightLabel =
          paperType
            .replace(/-/g, " ")
            .replace(/cover/gi, "")
            .replace(/coated/gi, "")
            .replace(/uncoated/gi, "")
            .replace(/silk/gi, "")
            .replace(/\s+/g, " ")
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
    const curated = ranked.filter((product) => {
      const key = product.finishLabel;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);

    const candidates = (curated.length > 0 ? curated : ranked.slice(0, 3)).map(
      ({ score: _score, finishLabel: _finishLabel, ...product }) => product
    );

    return NextResponse.json({ catalog, size, candidates, curated: true });
  } catch (error) {
    console.error("Gelato product discovery failed", error);
    return NextResponse.json({ error: "gelato_product_discovery_failed" }, { status: 502 });
  }
}
