import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase-server";
import { getGathering, getMenuItems } from "@/lib/host-data";
import { getMultiDayWorkspace } from "@/lib/multi-day-data";
import {
  paperPiece,
  paperSize,
  type PaperPieceKind,
  type PaperSizeId,
} from "@/lib/paper-suite-catalog";
import {
  encodePaperPayload,
  signPaperPayload,
  type PaperPrintPayload,
  type PaperTemplate,
} from "@/lib/paper-suite-print";

export const runtime = "nodejs";

const TEMPLATES = new Set<PaperTemplate>([
  "classic-editorial",
  "soft-botanical",
  "modern-clean",
  "warm-celebration",
]);

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://placeandplenty.com").replace(/\/$/, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

function formatTime(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: minute ? "2-digit" : undefined,
  }).format(d);
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        gatheringId?: string;
        kind?: PaperPieceKind;
        size?: PaperSizeId;
        template?: PaperTemplate;
        bodyCopy?: string;
      }
    | null;

  if (!body?.gatheringId || !body.kind || !body.size || !body.template || !TEMPLATES.has(body.template)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const piece = paperPiece(body.kind);
  const size = paperSize(body.size);
  if (!piece || !size || !piece.sizes.includes(body.size)) {
    return NextResponse.json({ error: "unsupported_piece_size" }, { status: 400 });
  }

  const gathering = await getGathering(body.gatheringId);
  if (!gathering) return NextResponse.json({ error: "gathering_not_found" }, { status: 404 });

  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload: PaperPrintPayload = {
    version: 2,
    kind: body.kind,
    size: body.size,
    template: body.template,
    gatheringName: gathering.name,
    dateLabel: gathering.gathering_end_date
      ? formatDate(gathering.gathering_date) + " – " + formatDate(gathering.gathering_end_date)
      : formatDate(gathering.gathering_date),
    timeLabel: formatTime(gathering.arrival_time),
    locationName: gathering.location_name,
    bodyCopy: body.bodyCopy?.trim().slice(0, 700) || null,
    expiresAt,
  };

  if (body.kind === "menu") {
    const menu = await getMenuItems(body.gatheringId);
    const labels: Record<string, string> = {
      appetizer: "Appetizers",
      protein: "Main Table",
      side: "Sides",
      dessert: "Dessert",
      beverage: "Beverages",
      other: "Also Serving",
    };

    const grouped = menu.reduce<Record<string, string[]>>((acc, item) => {
      const key = item.category || "other";
      (acc[key] ||= []).push(item.name);
      return acc;
    }, {});

    payload.menu = Object.entries(grouped).map(([category, items]) => ({
      heading: labels[category] || category,
      items: items.slice(0, 12),
    }));
  }

  if (body.kind === "itinerary") {
    if (gathering.duration_type !== "multi_day") {
      return NextResponse.json({ error: "itinerary_requires_multi_day" }, { status: 400 });
    }

    const workspace = await getMultiDayWorkspace(body.gatheringId);
    payload.days = workspace.days.slice(0, 7).map((day) => ({
      heading: day.title || formatDate(day.day_date),
      activities: workspace.activities
        .filter((activity) => activity.gathering_day_id === day.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .slice(0, 8)
        .map((activity) => ({
          time: formatTime(activity.start_time),
          title: activity.title,
          location: activity.location_name,
        })),
    }));
  }

  if (body.kind === "welcome-sign" && !payload.bodyCopy) {
    payload.bodyCopy = "We’re glad you’re here.";
  }

  if (body.kind === "thank-you" && !payload.bodyCopy) {
    payload.bodyCopy =
      "Thank you for gathering with us. We’re so glad you were part of it.";
  }

  if (body.kind === "details" && !payload.bodyCopy) {
    payload.bodyCopy =
      "Keep this card handy for the gathering details, timing and location.";
  }

  const encoded = encodePaperPayload(payload);
  const signature = signPaperPayload(encoded);
  const url =
    siteUrl() +
    "/api/paper-suite/print/render?p=" +
    encodeURIComponent(encoded) +
    "&s=" +
    encodeURIComponent(signature);

  return NextResponse.json({ url, expiresAt, piece: body.kind, size: body.size });
}
