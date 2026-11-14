import { test, expect, Page } from '@playwright/test';
import { t, RUN_TAG, webLogin, futureISO, recordCreated, shot, notInBuild, signInClient } from '../lib/helpers';
import { cfg, haveHostLogin } from '../lib/env';

// One disposable QA host account walks the host and guest journey. Everything created is named "E2E-QA …" and listed in
// test-results/created-objects.json so it can be cleaned up by exact id. Tests run in order and share state.
test.describe.configure({ mode: 'serial' });
test.skip(!haveHostLogin(), 'No QA test account supplied (QA_E2E_HOST_EMAIL / QA_E2E_HOST_PASSWORD or QA_E2E_CREDENTIALS_FILE).');

let singleDayId = '';
let guestToken = '';

type Outcome = { kind: 'created'; id: string } | { kind: 'multi-day-checkout'; id: string } | { kind: 'refused'; text: string };

async function nextStep(page: Page) {
  await page.getByRole('button', { name: /^next$/i }).click();
}

async function runWizard(page: Page, opts: { name: string; multiDay?: boolean; unknownCount?: boolean; adults?: number }): Promise<Outcome> {
  await page.goto('/host/create');
  // Step 1: name, kind, duration
  await page.getByPlaceholder(/barbara/i).fill(opts.name);
  await page.locator('button[aria-pressed]').first().click(); // first kind of gathering
  await page.getByRole('button', { name: opts.multiDay ? /multiple days/i : /^one day$/i }).click();
  await nextStep(page);
  // Step 2: dates (native date inputs)
  const dates = page.locator('input[type="date"]');
  await dates.first().fill(futureISO(opts.multiDay ? 30 : 21));
  if (opts.multiDay) await dates.nth(1).fill(futureISO(32));
  await nextStep(page);
  // Step 3: guests
  if (opts.unknownCount) {
    const chip = page.getByRole('button', { name: /not sure yet/i });
    await expect(chip, 'the "not sure yet" choice must be offered on QA').toBeVisible();
    await chip.click();
    await expect(page.getByRole('button', { name: /not sure yet/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('select[aria-label="Adults"]')).toHaveCount(0);
  } else {
    await page.locator('select[aria-label="Adults"]').selectOption(String(opts.adults ?? 4));
    await page.locator('select[aria-label="Children"]').selectOption('1');
  }
  await nextStep(page);
  // Step 4: place
  await page.getByPlaceholder('Home').fill('E2E test place');
  await nextStep(page);
  // Step 5: invitations
  await page.getByRole('button', { name: /i.ll do this later/i }).click();
  await nextStep(page);
  // Step 6: budget (optional)
  await page.getByRole('button', { name: /skip for now/i }).click().catch(() => {});
  await nextStep(page);
  // Step 7: food (default is fine)
  await nextStep(page);
  // Step 8: create
  await page.getByRole('button', { name: /create gathering/i }).click();
  const landed = await Promise.race([
    page.waitForURL(/\/host\/g\/[0-9a-f-]{36}/, { timeout: 45_000 }).then(() => 'g' as const),
    page.waitForURL(/\/checkout\/multi-day/, { timeout: 45_000 }).then(() => 'checkout' as const),
    page.getByRole('alert').first().waitFor({ timeout: 45_000 }).then(() => 'refused' as const),
  ]).catch(() => 'timeout' as const);
  if (landed === 'g') return { kind: 'created', id: page.url().match(/\/host\/g\/([0-9a-f-]{36})/)![1] };
  if (landed === 'checkout') return { kind: 'multi-day-checkout', id: new URL(page.url()).searchParams.get('gatheringId') ?? '' };
  if (landed === 'refused') return { kind: 'refused', text: (await page.getByRole('alert').first().innerText()).slice(0, 300) };
  throw new Error('The wizard neither finished nor showed a message within 45 seconds.');
}

test(t('H01', 'host signs in on the web with the disposable QA account'), async ({ page }, info) => {
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, '/host');
  await expect(page).toHaveURL(/\/host/);
  await shot(page, info, 'H01-signed-in');
});

test(t('H02', 'create a single-day gathering with the 8-step wizard'), async ({ page }, info) => {
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, '/host');
  const out = await runWizard(page, { name: `${RUN_TAG} single day` });
  info.annotations.push({ type: 'OUTCOME', description: out.kind === 'refused' ? `refused: ${out.text}` : out.kind });
  await shot(page, info, 'H02-after-create');
  if (out.kind === 'refused') throw new Error(`The app refused creation: "${out.text}". If this is the Free one-gathering limit, the test account already has an active gathering; clean it up and re-run.`);
  expect(out.kind).toBe('created');
  if (out.kind === 'created') { singleDayId = out.id; recordCreated('gathering', out.id, 'H02 single day'); }
});

test(t('H03', 'create a multi-day gathering: lands on the gathering OR on the Multi-Day checkout (state which)'), async ({ page }, info) => {
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, '/host');
  const out = await runWizard(page, { name: `${RUN_TAG} multi day`, multiDay: true });
  info.annotations.push({ type: 'OUTCOME', description: out.kind === 'refused' ? `refused: ${out.text}` : out.kind });
  await shot(page, info, 'H03-after-create');
  if (out.kind === 'refused') throw new Error(`The app refused multi-day creation: "${out.text}".`);
  if (out.id) recordCreated('gathering', out.id, `H03 multi day (${out.kind})`);
  expect(['created', 'multi-day-checkout']).toContain(out.kind);
});

test(t('H04', 'wizard accepts "I\'m not sure yet" for the guest count and shows the explanation'), async ({ page }, info) => {
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, '/host');
  await page.goto('/host/create');
  await page.getByPlaceholder(/barbara/i).fill(`${RUN_TAG} unknown count`);
  await page.locator('button[aria-pressed]').first().click();
  await page.getByRole('button', { name: /^one day$/i }).click();
  await nextStep(page);
  await page.locator('input[type="date"]').first().fill(futureISO(25));
  await nextStep(page);
  const chip = page.getByRole('button', { name: /not sure yet/i });
  if (await chip.count() === 0) notInBuild(info, 'The "not sure yet" choice is not offered (database or build lacks unknown-count support).');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('select[aria-label="Adults"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^next$/i })).toBeEnabled();
  await shot(page, info, 'H04-not-sure');
  // Toggle off again: the counts come back and Next needs at least one person.
  await chip.click();
  await expect(page.locator('select[aria-label="Adults"]')).toBeVisible();
});

test(t('H05', 'host adds a guest to the single-day gathering on My People'), async ({ page }, info) => {
  test.skip(!singleDayId, 'H02 did not create a gathering');
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, `/host/g/${singleDayId}/people`);
  await page.goto(`/host/g/${singleDayId}/people`);
  await page.getByLabel(/first name/i).last().fill('E2EGuest');
  await page.getByLabel(/last name/i).last().fill('QATest');
  await page.getByRole('button', { name: /add to this gathering/i }).click();
  await expect(page.getByText(/E2EGuest/).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, info, 'H05-guest-added');
});

test(t('H06', 'the invitation page opens from the guest token and RSVP "yes" is recorded (or says plainly why it is closed)'), async ({ page }, info) => {
  test.skip(!singleDayId, 'H02 did not create a gathering');
  const host = await signInClient(cfg.hostEmail, cfg.hostPassword);
  const { data, error } = await host.from('invitation_parties').select('public_token').eq('gathering_id', singleDayId).limit(1);
  expect(error, 'reading the guest link as the host').toBeNull();
  guestToken = data?.[0]?.public_token ?? '';
  expect(guestToken, 'a guest link (public token) must exist for the added guest').toBeTruthy();
  await page.goto(`/invite/${guestToken}`);
  await expect(page.getByRole('heading', { name: /rsvp/i })).toBeVisible({ timeout: 30_000 });
  const closed = page.getByText(/rsvps are closed|not accepting/i);
  if (await closed.count()) {
    await shot(page, info, 'H06-rsvp-closed');
    throw new Error('RSVP is closed for this gathering: ' + (await closed.first().innerText()) + ' (it probably needs invitations published first; this is the real state of the build under test).');
  }
  await page.getByRole('button', { name: /^yes$/i }).first().click();
  await page.getByRole('button', { name: /send rsvp/i }).click();
  await expect(page.getByText(/your response has been recorded/i)).toBeVisible({ timeout: 30_000 });
  await shot(page, info, 'H06-rsvp-recorded');
});

test(t('H07', 'host sees the guest\'s answer on My People'), async ({ page }, info) => {
  test.skip(!guestToken, 'H06 did not complete');
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, `/host/g/${singleDayId}/people`);
  await page.goto(`/host/g/${singleDayId}/people`);
  await expect(page.getByText(/E2EGuest/).first()).toBeVisible();
  await expect(page.getByText(/going|coming|yes/i).first()).toBeVisible();
  await shot(page, info, 'H07-host-view');
});

test(t('H08', 'share-by-text button on the web (the feature is native-only: Linking/Share)'), async ({ page }, info) => {
  test.skip(!singleDayId, 'H02 did not create a gathering');
  await webLogin(page, cfg.hostEmail, cfg.hostPassword, `/host/g/${singleDayId}/people`);
  await page.goto(`/host/g/${singleDayId}/people`);
  const control = page.getByRole('button', { name: /(share|send).*(by )?text|text.*(invitation|invite)/i });
  if (await control.count() === 0) notInBuild(info, 'There is no share-by-text control in the web app. Share-by-text is a native feature and can only be verified on a phone (see the device checklist).');
  await expect(control.first()).toBeVisible();
});

test(t('H09', 'list everything this run created so it can be cleaned up by exact id'), async ({}, info) => {
  const host = await signInClient(cfg.hostEmail, cfg.hostPassword);
  const { data } = await host.from('gatherings').select('id,name,status').like('name', 'E2E-QA%');
  for (const g of data ?? []) recordCreated('gathering', g.id, `${g.name} [${g.status}]`);
  await info.attach('gatherings-created.json', { body: JSON.stringify(data ?? [], null, 2), contentType: 'application/json' });
});
