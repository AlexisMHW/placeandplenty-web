import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { paperSize } from "@/lib/paper-suite-catalog";
import {
  decodePaperPayload,
  paperTemplateTokens,
  verifyPaperPayload,
} from "@/lib/paper-suite-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pieceLabel(kind: string) {
  switch (kind) {
    case "invitation":
      return "You’re Invited";
    case "details":
      return "Gathering Details";
    case "menu":
      return "Menu";
    case "itinerary":
      return "Weekend Itinerary";
    case "thank-you":
      return "Thank You";
    default:
      return "Place & Plenty";
  }
}

export async function GET(req: NextRequest) {
  const encoded = req.nextUrl.searchParams.get("p") || "";
  const signature = req.nextUrl.searchParams.get("s") || "";

  if (!encoded || !signature || !verifyPaperPayload(encoded, signature)) {
    return NextResponse.json({ error: "invalid_print_link" }, { status: 403 });
  }

  let payload;
  try {
    payload = decodePaperPayload(encoded);
  } catch {
    return NextResponse.json({ error: "invalid_print_payload" }, { status: 400 });
  }

  if (payload.expiresAt < Date.now()) {
    return NextResponse.json({ error: "print_link_expired" }, { status: 410 });
  }

  const size = paperSize(payload.size);
  if (!size) {
    return NextResponse.json({ error: "invalid_print_size" }, { status: 400 });
  }

  const tokens = paperTemplateTokens(payload.template);
  const tall = size.family === "tall" || size.family === "sign";
  const square = size.family === "square";
  const scale = size.widthPx / 1500;
  const padX = Math.round((square ? 110 : tall ? 100 : 120) * scale);
  const padY = Math.round((square ? 100 : tall ? 125 : 130) * scale);
  const titleSize = Math.round((square ? 66 : tall ? 62 : 72) * scale);
  const bodySize = Math.round((square ? 29 : tall ? 28 : 31) * scale);
  const eyebrowSize = Math.round(28 * scale);
  const contentGap = Math.round((tall ? 28 : 34) * scale);

  const isMenu = payload.kind === "menu";
  const isItinerary = payload.kind === "itinerary";
  const isInvitation = payload.kind === "invitation";
  const isDetails = payload.kind === "details";
  const isThankYou = payload.kind === "thank-you";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: tokens.background,
          color: tokens.text,
          padding: padY + "px " + padX + "px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: eyebrowSize,
              letterSpacing: Math.max(3, Math.round(5 * scale)),
              textTransform: "uppercase",
              color: tokens.accent,
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
            }}
          >
            {pieceLabel(payload.kind)}
          </div>
          <div
            style={{
              marginTop: Math.round(30 * scale),
              fontSize: titleSize,
              lineHeight: 1.05,
              maxWidth: size.widthPx - padX * 2,
            }}
          >
            {payload.gatheringName}
          </div>
          <div
            style={{
              marginTop: Math.round(22 * scale),
              height: Math.max(2, Math.round(3 * scale)),
              width: Math.round(120 * scale),
              background: tokens.accent,
            }}
          />
          <div
            style={{
              marginTop: Math.round(20 * scale),
              fontSize: Math.round(26 * scale),
              color: tokens.text,
              opacity: 0.72,
              fontFamily: "Arial, sans-serif",
              textAlign: "center",
            }}
          >
            {[payload.dateLabel, payload.timeLabel, payload.locationName]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {isMenu && (
          <div
            style={{
              marginTop: Math.round((tall ? 55 : 70) * scale),
              display: "flex",
              flexDirection: "column",
              gap: contentGap,
              alignItems: "center",
            }}
          >
            {(payload.menu || []).slice(0, tall ? 7 : 6).map((group) => (
              <div
                key={group.heading}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: Math.round(24 * scale),
                    letterSpacing: Math.max(2, Math.round(4 * scale)),
                    textTransform: "uppercase",
                    color: tokens.accent,
                    fontFamily: "Arial, sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {group.heading}
                </div>
                <div
                  style={{
                    marginTop: Math.round(10 * scale),
                    fontSize: Math.round((tall ? 30 : 34) * scale),
                    lineHeight: 1.42,
                    textAlign: "center",
                    maxWidth: size.widthPx - padX * 2,
                  }}
                >
                  {group.items.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}

        {isItinerary && (
          <div
            style={{
              marginTop: Math.round((tall ? 50 : 65) * scale),
              display: "flex",
              flexDirection: "column",
              gap: Math.round((tall ? 25 : 34) * scale),
            }}
          >
            {(payload.days || []).slice(0, size.family === "sign" ? 7 : tall ? 5 : 4).map((day) => (
              <div
                key={day.heading}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderTop: Math.max(1, Math.round(2 * scale)) + "px solid " + tokens.rule,
                  paddingTop: Math.round(16 * scale),
                }}
              >
                <div
                  style={{
                    fontSize: Math.round(25 * scale),
                    letterSpacing: Math.max(2, Math.round(4 * scale)),
                    textTransform: "uppercase",
                    color: tokens.accent,
                    fontFamily: "Arial, sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {day.heading}
                </div>
                <div
                  style={{
                    marginTop: Math.round(11 * scale),
                    display: "flex",
                    flexDirection: "column",
                    gap: Math.round(8 * scale),
                  }}
                >
                  {day.activities.slice(0, size.family === "sign" ? 8 : 6).map((activity, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        fontSize: Math.round((tall ? 27 : 31) * scale),
                        lineHeight: 1.28,
                      }}
                    >
                      <div
                        style={{
                          width: Math.round((tall ? 165 : 190) * scale),
                          flexShrink: 0,
                          fontFamily: "Arial, sans-serif",
                          fontWeight: 700,
                          color: tokens.text,
                        }}
                      >
                        {activity.time || ""}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div>{activity.title}</div>
                        {activity.location ? (
                          <div
                            style={{
                              marginTop: Math.round(3 * scale),
                              fontSize: Math.round(21 * scale),
                              color: tokens.text,
                              opacity: 0.62,
                              fontFamily: "Arial, sans-serif",
                            }}
                          >
                            {activity.location}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {(isInvitation || isDetails || isThankYou) && (
          <div
            style={{
              marginTop: Math.round((square ? 70 : tall ? 90 : 85) * scale),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {isInvitation && (
              <div
                style={{
                  fontSize: Math.round(34 * scale),
                  lineHeight: 1.5,
                  maxWidth: size.widthPx - padX * 2,
                }}
              >
                We’d love for you to gather with us.
              </div>
            )}
            {(isDetails || isThankYou) && (
              <div
                style={{
                  fontSize: bodySize,
                  lineHeight: 1.55,
                  maxWidth: size.widthPx - padX * 2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {payload.bodyCopy}
              </div>
            )}
            {isDetails && (
              <div
                style={{
                  marginTop: Math.round(44 * scale),
                  display: "flex",
                  flexDirection: "column",
                  gap: Math.round(14 * scale),
                  fontFamily: "Arial, sans-serif",
                  fontSize: Math.round(25 * scale),
                }}
              >
                {payload.dateLabel && <div>{payload.dateLabel}</div>}
                {payload.timeLabel && <div>{payload.timeLabel}</div>}
                {payload.locationName && <div>{payload.locationName}</div>}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: Math.round(28 * scale),
            borderTop: Math.max(1, Math.round(2 * scale)) + "px solid " + tokens.rule,
            display: "flex",
            justifyContent: "center",
            fontSize: Math.round(20 * scale),
            letterSpacing: Math.max(2, Math.round(3 * scale)),
            textTransform: "uppercase",
            color: tokens.text,
            opacity: 0.45,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Place & Plenty
        </div>
      </div>
    ),
    {
      width: size.widthPx,
      height: size.heightPx,
    }
  );
}
