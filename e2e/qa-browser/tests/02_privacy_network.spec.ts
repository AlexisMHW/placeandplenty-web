import { test, expect } from '@playwright/test';
import { t, blockAndRecordAnalytics, recordThirdParty, anySecretIn, Captured } from '../lib/helpers';

// Proves, in a real browser, that guest-link tokens, auth codes, e-mail addresses and names never appear in any
// request to Google/PostHog. Those hosts are BLOCKED here, so nothing is actually sent to them; each attempted request is recorded.
const SECRETS = ['FAKEINVITETOKEN123', 'FAKEGALLERYTOKEN456', 'FAKECOHOSTTOKEN789', 'FAKEAUTHCODE', 'betsy@example.com', 'Betsy', 'Hughes'];
const ROUTES: Record<string, string> = {
  invite: '/invite/FAKEINVITETOKEN123',
  gallery: '/gallery/FAKEGALLERYTOKEN456',
  cohost: '/host/co-host-invite/FAKECOHOSTTOKEN789',
  authCallback: '/auth/callback?code=FAKEAUTHCODE',
  queryPii: '/pricing?email=betsy@example.com&name=Betsy%20Hughes&utm_source=newsletter',
};
const CONSENT = { key: 'pp_analytics_consent_v1', version: '2026-11-13' };
const expectGating = process.env.QA_E2E_EXPECT_CONSENT_GATING !== '0';

for (const consent of ['no-choice', 'declined', 'accepted'] as const) {
  test(t(`PR-${consent}`, `no token, code, e-mail or name reaches an analytics request (visitor has ${consent})`), async ({ page, context }, info) => {
    const analytics: Captured[] = [];
    const thirdParty: Captured[] = [];
    await blockAndRecordAnalytics(page, analytics);
    recordThirdParty(page, thirdParty);
    if (consent !== 'no-choice') {
      const choice = consent === 'accepted' ? 'granted' : 'denied';
      await context.addInitScript(([k, v, c]) => {
        try { localStorage.setItem(k, JSON.stringify({ choice: c, version: v, at: new Date().toISOString() })); } catch {}
      }, [CONSENT.key, CONSENT.version, choice]);
    }
    for (const [name, route] of Object.entries(ROUTES)) {
      await page.goto(route, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(1500); // give analytics libraries time to try
      info.annotations.push({ type: `visited ${name}`, description: `${analytics.length} analytics requests attempted so far` });
    }
    await info.attach('analytics-requests-attempted.json', {
      body: JSON.stringify(analytics.map((a) => ({ method: a.method, url: a.url.replace(/([?&](?:dl|dp|dt|u|ep\.[^=]*|p)=)[^&]*/g, '$1…') })), null, 2),
      contentType: 'application/json',
    });
    const leaks = anySecretIn([...analytics, ...thirdParty], SECRETS);
    expect(leaks, `secrets found in third-party requests: ${JSON.stringify(leaks)}`).toEqual([]);
    if (consent !== 'accepted' && expectGating) {
      expect(analytics.map((a) => a.url), 'without an explicit "accept" no analytics request should be attempted').toEqual([]);
    }
  });
}

// Proves the recording and leak-detection chain itself works: this deliberately tries to send a fake token to Google.
// It is blocked, recorded and must be reported as a leak. If this test fails, the other privacy results cannot be trusted.
test(t('PR-canary', 'the leak detector catches a deliberate fake token sent to an analytics host (and the request is blocked)'), async ({ page }) => {
  const analytics: Captured[] = [];
  await blockAndRecordAnalytics(page, analytics);
  await page.goto('/privacy');
  await page.evaluate(() => fetch('https://www.google-analytics.com/g/collect?dl=' + encodeURIComponent('https://x.example/invite/FAKEINVITETOKEN123'), { mode: 'no-cors' }).catch(() => null));
  await page.waitForTimeout(500);
  expect(anySecretIn(analytics, SECRETS).length).toBeGreaterThan(0);
});
