import { Page, Request, TestInfo, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { cfg } from './env';

export const SUITE_LABEL = 'browser test against QA';
export const NOT_NATIVE = 'NOT proof that the released iPhone/Android apps work';

/** Every test title starts with this so a log can never be mistaken for device or production evidence. */
export const t = (id: string, what: string) => `[${SUITE_LABEL}] ${id} ${what}`;

export const RUN_TAG = `E2E-QA ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

/** Third-party analytics hosts. */
export const ANALYTICS_HOST_RE = /(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|posthog\.com)/i;
// The libraries themselves may be downloaded (so the REAL library runs and tries to send what it would really send).
// Everything else sent to these hosts is recorded and then BLOCKED, so no fake token can ever reach Google or PostHog.
const LIBRARY_DOWNLOAD_RE = /(googletagmanager\.com\/gtag\/js|posthog\.com\/(static|array)\/)/i;

export interface Captured { url: string; method: string; body: string; headers: string }

export async function blockAndRecordAnalytics(page: Page, sink: Captured[]) {
  await page.route(ANALYTICS_HOST_RE, async (route) => {
    const r = route.request();
    if (r.method() === 'GET' && LIBRARY_DOWNLOAD_RE.test(r.url())) return route.continue();
    sink.push({ url: r.url(), method: r.method(), body: r.postData() ?? '', headers: JSON.stringify(r.headers()) });
    return route.abort();
  });
}

/** Everything the page asked a non-site, non-QA host for (to prove nothing else leaks). */
export function recordThirdParty(page: Page, sink: Captured[]) {
  const siteHost = new URL(cfg.baseUrl).host;
  const qaHost = cfg.supabaseUrl ? new URL(cfg.supabaseUrl).host : '';
  page.on('request', (r: Request) => {
    let host = '';
    try { host = new URL(r.url()).host; } catch { return; }
    if (host === siteHost || host === qaHost || r.url().startsWith('data:') || r.url().startsWith('blob:')) return;
    sink.push({ url: r.url(), method: r.method(), body: r.postData() ?? '', headers: JSON.stringify(r.headers()) });
  });
}

export function anySecretIn(c: Captured[], secrets: string[]) {
  const hits: { url: string; secret: string }[] = [];
  for (const row of c) {
    const hay = decodeURIComponent(row.url) + ' ' + row.url + ' ' + row.body + ' ' + row.headers;
    for (const s of secrets) if (s && (hay.includes(s) || hay.includes(encodeURIComponent(s)))) hits.push({ url: row.url.slice(0, 120), secret: s.length > 6 ? s.slice(0, 3) + '…' : s });
  }
  return hits;
}

export function qaClient(): SupabaseClient {
  return createClient(cfg.supabaseUrl, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function signInClient(email: string, password: string): Promise<SupabaseClient> {
  const c = qaClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error('QA sign-in failed for the test account (' + error.message + ')');
  return c;
}

export async function webLogin(page: Page, email: string, password: string, next = '/host') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole('button', { name: /^(log in|sign in)/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
}

export function futureISO(daysAhead: number) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

/** Records every gathering the suite creates so the owner/Claude can clean up with exact ids. Contains ids only, no secrets. */
const MANIFEST = path.resolve(__dirname, '..', 'test-results', 'created-objects.json');
export function recordCreated(kind: string, id: string, note = '') {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const cur = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : [];
  cur.push({ kind, id, note, at: new Date().toISOString() });
  fs.writeFileSync(MANIFEST, JSON.stringify(cur, null, 2));
}

export async function shot(page: Page, info: TestInfo, name: string) {
  const file = info.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await info.attach(name, { path: file, contentType: 'image/png' });
}

/** Marks a result honestly instead of silently passing or failing when a feature is absent from the build under test. */
export function notInBuild(info: TestInfo, why: string) {
  info.annotations.push({ type: 'NOT IN THIS BUILD', description: why });
  info.skip(true, 'NOT IN THIS BUILD: ' + why);
}

export { expect };
