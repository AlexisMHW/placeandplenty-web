import { createHmac, timingSafeEqual } from "node:crypto";

export type PaperTemplate =
  | "classic-editorial"
  | "soft-botanical"
  | "modern-clean"
  | "warm-celebration";

export type PaperPrintPayload = {
  version: 1;
  kind: "menu" | "itinerary";
  template: PaperTemplate;
  gatheringName: string;
  dateLabel?: string;
  locationName?: string | null;
  menu?: Array<{ heading: string; items: string[] }>;
  days?: Array<{
    heading: string;
    activities: Array<{ time?: string | null; title: string; location?: string | null }>;
  }>;
  expiresAt: number;
};

function secret() {
  const value = process.env.GELATO_API_KEY?.trim();
  if (!value) throw new Error("gelato_not_configured");
  return value;
}

export function encodePaperPayload(payload: PaperPrintPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePaperPayload(encoded: string): PaperPrintPayload {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PaperPrintPayload;
}

export function signPaperPayload(encoded: string): string {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function verifyPaperPayload(encoded: string, signature: string): boolean {
  const expected = signPaperPayload(encoded);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function paperTemplateTokens(template: PaperTemplate) {
  switch (template) {
    case "soft-botanical":
      return { background: "#E8EDE4", text: "#1E3A2E", accent: "#71856F", rule: "#AAB9A6" };
    case "modern-clean":
      return { background: "#FFFFFF", text: "#142720", accent: "#142720", rule: "#D7DDD8" };
    case "warm-celebration":
      return { background: "#EFE6D5", text: "#1E3A2E", accent: "#A77C25", rule: "#D4BE8D" };
    default:
      return { background: "#F7F4EC", text: "#1E3A2E", accent: "#C9A227", rule: "#D8D0BD" };
  }
}
