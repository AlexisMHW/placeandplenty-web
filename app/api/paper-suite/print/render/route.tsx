import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import {
  decodePaperPayload,
  paperTemplateTokens,
  verifyPaperPayload,
} from "@/lib/paper-suite-print";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const tokens = paperTemplateTokens(payload.template);
  const isMenu = payload.kind === "menu";

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
          padding: "130px 120px",
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
              fontSize: 30,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: tokens.accent,
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
            }}
          >
            {isMenu ? "Menu" : "Weekend Itinerary"}
          </div>
          <div
            style={{
              marginTop: 34,
              fontSize: 72,
              lineHeight: 1.05,
              maxWidth: 1180,
            }}
          >
            {payload.gatheringName}
          </div>
          <div
            style={{
              marginTop: 24,
              height: 3,
              width: 120,
              background: tokens.accent,
            }}
          />
          <div
            style={{
              marginTop: 22,
              fontSize: 28,
              color: tokens.text,
              opacity: 0.72,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {[payload.dateLabel, payload.locationName].filter(Boolean).join(" · ")}
          </div>
        </div>

        {isMenu ? (
          <div
            style={{
              marginTop: 70,
              display: "flex",
              flexDirection: "column",
              gap: 34,
              alignItems: "center",
            }}
          >
            {(payload.menu || []).slice(0, 6).map((group) => (
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
                    fontSize: 26,
                    letterSpacing: 4,
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
                    marginTop: 12,
                    fontSize: 34,
                    lineHeight: 1.45,
                    textAlign: "center",
                    maxWidth: 1180,
                  }}
                >
                  {group.items.join(" · ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 65,
              display: "flex",
              flexDirection: "column",
              gap: 34,
            }}
          >
            {(payload.days || []).slice(0, 4).map((day) => (
              <div
                key={day.heading}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderTop: "2px solid " + tokens.rule,
                  paddingTop: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    letterSpacing: 4,
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
                    marginTop: 13,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {day.activities.map((activity, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        fontSize: 31,
                        lineHeight: 1.3,
                      }}
                    >
                      <div
                        style={{
                          width: 190,
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
                              marginTop: 3,
                              fontSize: 23,
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

        <div
          style={{
            marginTop: "auto",
            paddingTop: 30,
            borderTop: "2px solid " + tokens.rule,
            display: "flex",
            justifyContent: "center",
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: tokens.text,
            opacity: 0.48,
            fontFamily: "Arial, sans-serif",
          }}
        >
          Place & Plenty
        </div>
      </div>
    ),
    {
      width: 1500,
      height: 2100,
    }
  );
}
