// Referral attribution helpers (pure, no deps). PROPOSED PATCH: not applied to wt-web.
// First-touch: an existing unexpired referral cookie is never overwritten.
export const REFERRAL_COOKIE = 'pp_ref';
export const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;
export const CODE_RE = /^[a-z0-9-]{3,32}$/;

export function normalizeCode(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().toLowerCase();
  return CODE_RE.test(c) ? c : null;
}

export type Touch = { code: string; touchedAt: number };

export function buildCookieValue(t: Touch): string {
  return `${t.code}.${Math.floor(t.touchedAt / 1000)}`;
}

export function parseCookieValue(v: string | null | undefined, now = Date.now()): Touch | null {
  if (!v) return null;
  const i = v.lastIndexOf('.');
  if (i < 1) return null;
  const code = normalizeCode(v.slice(0, i));
  const secs = Number(v.slice(i + 1));
  if (!code || !Number.isInteger(secs) || secs <= 0) return null;
  const touchedAt = secs * 1000;
  if (touchedAt > now + 5 * 60_000) return null;
  if (now - touchedAt > WINDOW_DAYS * DAY_MS) return null;
  return { code, touchedAt };
}

// First-touch precedence: keep the existing valid touch, otherwise take the new one.
export function nextTouch(existing: string | null | undefined, newCode: string | null, now = Date.now()): Touch | null {
  const cur = parseCookieValue(existing, now);
  if (cur) return cur;
  const code = normalizeCode(newCode);
  return code ? { code, touchedAt: now } : null;
}

export const cookieMaxAgeSeconds = () => WINDOW_DAYS * 86_400;

// ---- Fixed-amount economics (mirror of SQL 212002/212003; the DATABASE is authoritative, this exists for UI previews + tests) ----
// Amounts, hold and payout minimum come from versioned terms rows and are NEVER hardcoded in screens; DEFAULT_TERMS mirrors the
// owner-approved version 1 only so mock data and tests have something to start from.
export type CommissionableProduct = 'gathering_pass' | 'plus_annual';
export interface Terms { version: number; effectiveFrom: number; validationDays: number; minPayoutCents: number; amounts: Partial<Record<CommissionableProduct, number>> }
export const DEFAULT_TERMS: Terms = { version: 1, effectiveFrom: 0, validationDays: 45, minPayoutCents: 5000, amounts: { gathering_pass: 50, plus_annual: 1200 } };

export function isCommissionableProduct(p: string): p is CommissionableProduct { return p === 'gathering_pass' || p === 'plus_annual'; }   // Multi-Day Pass / extension: never

export function termsInForce(versions: Terms[], at: number): Terms | null {
  const ok = versions.filter((v) => v.effectiveFrom <= at).sort((x, y) => y.effectiveFrom - x.effectiveFrom || y.version - x.version);
  return ok[0] ?? null;
}

// The frozen copy stored on each commission. Object.freeze makes accidental later mutation throw in strict mode.
export interface CommissionSnapshot { termsVersion: number; product: CommissionableProduct; amountCents: number; validationDays: number; minPayoutCents: number; purchasedAt: number }
export function snapshotCommission(versions: Terms[], product: string, purchasedAt: number): Readonly<CommissionSnapshot> | null {
  if (!isCommissionableProduct(product)) return null;
  const t = termsInForce(versions, purchasedAt); const amount = t?.amounts[product];
  if (!t || amount == null) return null;
  return Object.freeze({ termsVersion: t.version, product, amountCents: amount, validationDays: t.validationDays, minPayoutCents: t.minPayoutCents, purchasedAt });
}

// First qualifying paid purchase only: any earlier paid purchase (any product, any store) disqualifies (upgrade, repeat, renewal).
export function isFirstPaidPurchase(priorPaidPurchases: number): boolean { return priorPaidPurchases === 0; }

export function isValidatable(snap: Pick<CommissionSnapshot, 'purchasedAt' | 'validationDays'>, now: number) {
  return now >= snap.purchasedAt + snap.validationDays * DAY_MS;
}

// $50 is a COMBINED balance across products; each commission keeps the minimum of its own snapshot (lowest applies, documented in v2 architecture).
export function payoutDecision(validated: CommissionSnapshot[]) {
  const total = validated.reduce((n, c) => n + c.amountCents, 0);
  const min = validated.length ? Math.min(...validated.map((c) => c.minPayoutCents)) : 5000;
  return { total, min, eligible: total > 0 && total >= min };
}
