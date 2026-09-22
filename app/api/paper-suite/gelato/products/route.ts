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
  "4x6": ["4x6", "4 x 6", "10x15", "10 x 15", "a6"],
  "5x7": ["5x7", "5 x 7", "13x18", "13 x 18", "5r"],
  "4x9": ["4x9", "4 x 9", "dl", "10x21", "10 x 21"],
  "square-5": ["5x5", "5 x 5", "square", "13x13", "13 x 13"],
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

    const candidates = (response.products || [])
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

        return portraitOrUnspecified && printableColor && matchesRequestedSize(attrs, size);
      })
      .slice(0, 36)
      .map((product) => ({
        productUid: product.productUid,
        attributes: product.attributes,
      }));

    return NextResponse.json({ catalog, size, candidates });
  } catch (error) {
    console.error("Gelato product discovery failed", error);
    return NextResponse.json({ error: "gelato_product_discovery_failed" }, { status: 502 });
  }
}
