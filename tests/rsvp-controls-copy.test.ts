import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyRsvpError } from '../lib/rsvp-controls-copy.ts';

test('maps stable server codes to friendly copy', () => {
  assert.match(friendlyRsvpError({ message: 'not_authorized' }), /don’t have access/);
  assert.match(friendlyRsvpError({ message: 'gathering_not_editable' }), /finished or archived/);
  assert.match(friendlyRsvpError({ message: 'deadline_in_past' }), /future/);
  assert.match(friendlyRsvpError({ message: 'invalid_request' }), /deadline date/);
  assert.match(friendlyRsvpError({ message: 'not_found' }), /couldn’t find/);
});
test('429 and rate_limited show a wait message', () => {
  assert.match(friendlyRsvpError({ message: 'x', status: 429 }), /wait a moment/);
  assert.match(friendlyRsvpError({ message: 'rate_limited' }), /wait a moment/);
});
test('unknown and null fall back safely and never leak raw text', () => {
  assert.equal(friendlyRsvpError(null), 'That didn’t save. Please try again.');
  assert.doesNotMatch(friendlyRsvpError({ message: 'pg internal detail xyz' }), /xyz/);
});
