import { test, expect } from '@playwright/test';
import { t, shot } from '../lib/helpers';

test.describe('public pages (no account needed)', () => {
  test(t('P01', 'sign-up page shows its fields and rejects a too-short password without contacting the server'), async ({ page }, info) => {
    const calls: string[] = [];
    page.on('request', (r) => { if (/\/auth\/v1\//.test(r.url())) calls.push(r.url()); });
    await page.goto('/signup');
    await expect(page.getByLabel(/first name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await page.getByLabel(/email/i).first().fill('nobody@example.invalid');
    await page.getByLabel(/password/i).first().fill('short');
    await page.locator('form').getByRole('button', { name: /start free/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    expect(calls, 'a too-short password must not reach the auth server').toEqual([]);
    await shot(page, info, 'P01-signup');
  });

  test(t('P02', 'log-in page shows a plain error for a wrong password (no account is created, no email is sent)'), async ({ page }, info) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).first().fill('nobody+e2e@example.invalid');
    await page.getByLabel(/password/i).first().fill('definitely-not-a-real-password');
    await page.getByRole('button', { name: /^(log in|sign in)/i }).first().click();
    await expect(page.getByText(/invalid login credentials|incorrect|couldn.t sign you in/i)).toBeVisible({ timeout: 30_000 });
    await shot(page, info, 'P02-login-error');
  });

  test(t('P03', 'signed-out visit to /host is sent to the log-in page'), async ({ page }) => {
    await page.goto('/host');
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('next')).toMatch(/^\/host/);
  });

  test(t('P04', 'an unknown invitation link says it is not valid and is marked noindex'), async ({ page }, info) => {
    await page.goto('/invite/NOT-A-REAL-TOKEN-E2E');
    await expect(page.getByText(/invitation link isn.t valid/i)).toBeVisible({ timeout: 30_000 });
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots ?? '').toMatch(/noindex/i);
    await shot(page, info, 'P04-invite-unknown');
  });

  test(t('P05', 'an unknown gallery link does not show a gathering'), async ({ page }) => {
    const res = await page.goto('/gallery/NOT-A-REAL-GALLERY-E2E');
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText(/isn.t available|isn.t valid|not found|no longer available|couldn.t find/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test(t('P06', 'Command Center is not available to a signed-out visitor'), async ({ page }, info) => {
    const res = await page.goto('/command-center');
    const status = res?.status() ?? 0;
    const url = new URL(page.url());
    if (status === 404 && url.pathname === '/command-center') {
      info.annotations.push({ type: 'NOT IN THIS BUILD', description: '/command-center returns 404: the Command Center is not in the build under test, so access control was NOT exercised.' });
      test.skip(true, 'NOT IN THIS BUILD: /command-center is absent, access control not exercised');
    }
    const body = (await page.locator('body').innerText()).toLowerCase();
    const sentAway = url.pathname !== '/command-center';
    expect(sentAway || status === 401 || status === 403, `signed-out visitor must be redirected or refused (status ${status}, path ${url.pathname})`).toBeTruthy();
    expect(body).not.toMatch(/overview|revenue|staff|audit log/);
  });
});
