// SELF-CHECK ONLY (runs only when QA_E2E_MODE=stub). Uses a fake signed-in session against a fake backend to prove the create-gathering
// wizard selectors in 03_host_journey.spec.ts find the right controls on steps 1-4. It proves NOTHING about QA data or saving.
import { test, expect } from '@playwright/test';
import { cfg } from '../lib/env';
import { futureISO } from '../lib/helpers';

test.skip(cfg.mode !== 'stub', 'stub self-check only');

function fakeSessionCookie(supabaseUrl: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-4000-8000-000000000001', exp, role: 'authenticated' })}.STUBSESSION`;
  const session = { access_token: jwt, refresh_token: 'stub-refresh', expires_in: 3600, expires_at: exp, token_type: 'bearer',
    user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'stub-host@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
  const name = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  return { name, value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url') };
}

test('[browser test against QA] S01 (stub) wizard steps 1-4 expose the controls the journey test uses', async ({ page, context }, info) => {
  const c = fakeSessionCookie(cfg.supabaseUrl);
  await context.addCookies([{ name: c.name, value: c.value, url: cfg.baseUrl }]);
  await page.goto('/host/create');
  await expect(page.getByPlaceholder(/barbara/i)).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder(/barbara/i).fill('E2E selector check');
  await page.locator('button[aria-pressed]').first().click();
  await page.getByRole('button', { name: /multiple days/i }).click();
  await page.getByRole('button', { name: /^one day$/i }).click();
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.locator('input[type="date"]').first()).toBeAttached({ timeout: 30_000 });
  await page.locator('input[type="date"]').first().fill(futureISO(21));
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.locator('select[aria-label="Adults"]')).toBeAttached({ timeout: 30_000 });
  await page.locator('select[aria-label="Adults"]').selectOption('4');
  await page.locator('select[aria-label="Children"]').selectOption('1');
  const chip = await page.getByRole('button', { name: /not sure yet/i }).count();
  info.annotations.push({ type: 'not-sure-chip-offered-with-stub-backend', description: String(chip) });
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByPlaceholder('Home')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('Home').fill('E2E test place');
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByRole('button', { name: /i.ll do this later/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /i.ll do this later/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByRole('button', { name: /skip for now/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /skip for now/i }).click();
  await page.getByRole('button', { name: /^next$/i }).click(); // to food
  await page.getByRole('button', { name: /^next$/i }).click(); // to notes
  await expect(page.getByRole('button', { name: /create gathering/i })).toBeVisible({ timeout: 30_000 });
});
