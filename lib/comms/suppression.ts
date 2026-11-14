// Suppression + unsubscribe core (web mirror of the native email_suppressions model). Addresses are stored ONLY as a keyed hash.
export interface SuppressionStore {
  has(hash: string): Promise<boolean>;
  add(hash: string, reason: "unsubscribe" | "bounce" | "complaint"): Promise<void>;
}

export function normalizeEmail(raw: string): string | null {
  const e = (raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** HMAC-SHA256(hex) of the normalized address. Returns null for malformed input or a missing key (callers fail open on read, closed on write). */
export async function hashEmail(raw: string, key: string | undefined): Promise<string | null> {
  const e = normalizeEmail(raw);
  if (!e || !key) return null;
  const subtle = globalThis.crypto.subtle;
  const k = await subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign("HMAC", k, new TextEncoder().encode(e)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createMemorySuppressionStore(): SuppressionStore & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return { entries, async has(h) { return entries.has(h); }, async add(h, r) { if (!entries.has(h)) entries.set(h, r); } };
}
