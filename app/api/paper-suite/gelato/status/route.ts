import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { listGelatoCatalogs } from "@/lib/gelato";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ connected: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.GELATO_API_KEY) {
    return NextResponse.json({ connected: false, error: "gelato_not_configured" }, { status: 503 });
  }

  try {
    const catalogs = await listGelatoCatalogs();
    const printable = catalogs
      .filter((catalog) =>
        ["cards", "stationery", "posters", "multipage"].some((needle) =>
          (catalog.catalogUid + " " + catalog.title).toLowerCase().includes(needle)
        )
      )
      .map((catalog) => ({
        catalogUid: catalog.catalogUid,
        title: catalog.title,
      }));

    return NextResponse.json({
      connected: true,
      printableCatalogs: printable,
    });
  } catch (error) {
    console.error("Gelato connection check failed", error);
    return NextResponse.json(
      { connected: false, error: "gelato_connection_failed" },
      { status: 502 }
    );
  }
}
