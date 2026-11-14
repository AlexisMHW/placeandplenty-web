import { test, expect } from '@playwright/test';
import { t, webLogin, notInBuild, shot } from '../lib/helpers';
import { cfg, haveHostLogin } from '../lib/env';

// Needs a signed-in account that is NOT staff. The disposable QA host account is not staff.
test(t('CC01', 'a signed-in non-staff account is refused at /command-center'), async ({ page }, info) => {
  test.skip(!haveHostLogin(), 'No QA test account supplied (QA_E2E_HOST_EMAIL / QA_E2E_HOST_PASSWORD or QA_E2E_CREDENTIALS_FILE).');
  const email = cfg.nonStaffEmail || cfg.hostEmail;
  const password = cfg.nonStaffEmail ? cfg.nonStaffPassword : cfg.hostPassword;
  await webLogin(page, email, password, '/host');
  const res = await page.goto('/command-center');
  const status = res?.status() ?? 0;
  if (status === 404 && new URL(page.url()).pathname === '/command-center') {
    notInBuild(info, '/command-center returns 404: the Command Center is not in the build under test, so access control was NOT exercised.');
  }
  const path = new URL(page.url()).pathname;
  const body = (await page.locator('body').innerText()).toLowerCase();
  await shot(page, info, 'CC01-non-staff');
  expect(path !== '/command-center' || status === 403 || /not authorized|no access|not available|permission/.test(body),
    `non-staff must be sent away or refused (status ${status}, path ${path})`).toBeTruthy();
  expect(body).not.toMatch(/revenue|audit log|staff members|commission/);
});
