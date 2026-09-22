import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { searchGelatoProducts } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATALOGS = new Set([
  "cards",
  "stationery",
  "stationery-business",
  "posters",
]);

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const catalog = req.nextUrl.searchParams.get("catalog") || "cards";
  if (!ALLOWED_CATALOGS.has(catalog)) {
    return NextResponse.json({ error: "unsupported_catalog" }, { status: 400 });
  }

  try {
    const response = await searchGelatoProducts(catalog, { limit: 100, offset: 0 });

    const candidates = (response.products || [])
      .filter((product) => {
        const attrs = product.attributes || {};
        const orientation = String(attrs.Orientation || "").toLowerCase();
        const color = String(attrs.ColorType || "").toLowerCase();
        const format = String(attrs.PaperFormat || "").toLowerCase();

        const portraitOrUnspecified = !orientation || orientation === "ver" || orientation === "portrait";
        const printableColor = !color || color.includes("4-0") || color.includes("4-4");
        const usefulFormat =
          !format ||
          ["5r", "a5", "a6", "dl", "4x6", "5x7", "square"].some((value) =>
            format.includes(value)
          );

        return portraitOrUnspecified && printableColor && usefulFormat;
      })
      .slice(0, 24)
      .map((product) => ({
        productUid: product.productUid,
        attributes: product.attributes,
      }));

    return NextResponse.json({ catalog, candidates });
  } catch (error) {
    console.error("Gelato product discovery failed", error);
    return NextResponse.json({ error: "gelato_product_discovery_failed" }, { status: 502 });
  }
}
