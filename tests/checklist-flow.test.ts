import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CHECKLISTS, CHECKLIST_HELP, checklistPdf } from '../lib/checklists.ts';
import { checklistDestination, checklistSignupUrl, checklistLoginUrl, checklistPreset } from '../lib/checklist-flow.ts';
import { safeNext, callbackUrl } from '../lib/auth-redirects.ts';
import { GATHERING_TYPES } from '../lib/gathering-creation.ts';
import { deliverChecklist } from '../lib/checklist-delivery.ts';

for (const edition of ['friendsgiving', 'bachelorette-weekend', 'family-reunion']) {
  test(`${edition}: lead request, download and auth continuation remain connected`, async () => {
    const requested: Record<string, unknown>[] = [];
    const transport = (async (_url, init) => {
      requested.push(JSON.parse(String(init?.body)));
      return Response.json({ success: true });
    }) as typeof fetch;
    const response = await deliverChecklist({ edition, firstName: 'Test', email: 'test@example.com', consent: false, website: '' }, 'test', { supabaseUrl: 'https://test.example', anonKey: 'test' }, transport);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.download, checklistPdf(edition));
    const pdf = readFileSync(new URL(`../public${body.download}`, import.meta.url));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(body.emailSent, false);
    assert.equal(requested.length, 1, 'no marketing or delivery email without a configured provider');
    for (const entry of [checklistSignupUrl(edition), checklistLoginUrl(edition)]) {
      const next = new URL(entry, 'https://placeandplenty.com').searchParams.get('next');
      assert.equal(safeNext(next), checklistDestination(edition));
      const callback = new URL(callbackUrl('https://placeandplenty.com', safeNext(next)));
      assert.equal(safeNext(callback.searchParams.get('next')), checklistDestination(edition));
    }
    const preset = checklistPreset(edition)!;
    assert.ok(GATHERING_TYPES.includes(preset.gatheringType!));
    assert.equal(preset.durationType, undefined, 'campaign does not force paid Multi-Day access');
  });
}
test('every public kit has content, artwork and an actual download', () => {
  for (const kit of CHECKLISTS) {
    assert.ok(CHECKLIST_HELP[kit.slug]?.steps.length);
    assert.ok(existsSync(new URL(`../public${kit.image}`, import.meta.url)));
    assert.ok(existsSync(new URL(`../public${checklistPdf(kit.slug)}`, import.meta.url)));
  }
});
test('auth destinations reject external URLs and loops while preserving legitimate queries', () => {
  for (const next of ['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example', '/login', '/signup', '/auth/callback', '/a/../login']) assert.equal(safeNext(next), '/host');
  assert.equal(safeNext('/host/create?checklist=friendsgiving'), '/host/create?checklist=friendsgiving');
  assert.equal(safeNext('/reset-password'), '/reset-password');
  assert.equal(checklistPreset('not-a-kit'), undefined);
  assert.equal(checklistDestination('not-a-kit'), '/host/create');
});
