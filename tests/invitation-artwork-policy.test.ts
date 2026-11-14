import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALREADY_SENT_NOTE,
  MANAGE_INVITATIONS_CAPABILITY,
  artworkFailureMessage,
  canManageInvitationArtwork,
  decideCleanup,
} from '../lib/invitation-artwork-policy.ts';

const G = 'g1';

test('capability name is stable (COHOST-PERMS wires this string)', () => {
  assert.equal(MANAGE_INVITATIONS_CAPABILITY, 'manage_invitations');
});

test('authorization hint: owner, co-host legacy/with-capability, others', () => {
  assert.equal(canManageInvitationArtwork('owner', []), true);
  assert.equal(canManageInvitationArtwork('co_host'), true);
  assert.equal(canManageInvitationArtwork('co_host', null), true);
  assert.equal(canManageInvitationArtwork('co_host', ['manage_menu']), false);
  assert.equal(canManageInvitationArtwork('co_host', ['manage_invitations']), true);
  assert.equal(canManageInvitationArtwork('none', ['manage_invitations']), false);
});

test('cleanup is refused for missing, identical, foreign, unknown and still-referenced paths', () => {
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: null, allowedByServer: true }), { delete: false, reason: 'no_old_path' });
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: `${G}/a`, newPath: `${G}/a`, allowedByServer: true }), { delete: false, reason: 'same_as_new' });
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: 'canva/a', allowedByServer: true }), { delete: false, reason: 'foreign_folder' });
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: 'g2/a', allowedByServer: true }), { delete: false, reason: 'foreign_folder' });
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: `${G}/a`, allowedByServer: null }), { delete: false, reason: 'check_unavailable' });
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: `${G}/a`, allowedByServer: false }), { delete: false, reason: 'still_referenced' });
});

test('cleanup is allowed only for this gathering\'s own, unreferenced, different file', () => {
  assert.deepEqual(decideCleanup({ gatheringId: G, oldPath: `${G}/old`, newPath: `${G}/new`, allowedByServer: true }), { delete: true, reason: 'ok' });
});

test('failure copy: permission vs generic, never leaks raw text, says current artwork is intact', () => {
  assert.match(artworkFailureMessage({ message: 'not authorized' }, 'replace'), /permission/);
  assert.match(artworkFailureMessage({ message: 'new row violates row-level security' }, 'remove'), /permission/);
  assert.match(artworkFailureMessage({ message: 'pg detail xyz' }, 'replace'), /unchanged/);
  assert.doesNotMatch(artworkFailureMessage({ message: 'pg detail xyz' }, 'remove'), /xyz/);
  assert.match(artworkFailureMessage(null, 'remove'), /still in place/);
});

test('honest copy about previously sent invitations', () => {
  assert.match(ALREADY_SENT_NOTE, /already received an invitation won't see the new artwork unless you resend/);
});
