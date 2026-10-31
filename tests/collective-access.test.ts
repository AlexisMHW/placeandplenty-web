import test from 'node:test';
import assert from 'node:assert/strict';
import { collectiveRole, requiresAccount } from '../lib/collective-access.ts';
const user = { email_confirmed_at: '2026-10-31', app_metadata: { hosting_collective: { role: 'partner', status: 'active' } } };
test('host segment and private hub require login while public collective routes do not', () => {
  for (const path of ['/host','/host/account','/hosting-collective/hub','/hosting-collective/hub/resources']) assert.equal(requiresAccount(path),true);
  for (const path of ['/hosting-collective','/hosting-collective/join','/hosting-collective/apply','/hosting-collective/hub-public']) assert.equal(requiresAccount(path),false);
});
test('active trusted roles alone unlock resources', () => {
  assert.equal(collectiveRole(user),'partner');
  assert.equal(collectiveRole({...user, app_metadata:{hosting_collective:{role:'contributor',status:'active'}}}),'contributor');
  for (const status of ['pending','approved','suspended','revoked']) assert.equal(collectiveRole({...user,app_metadata:{hosting_collective:{role:'partner',status}}}),null);
});
test('unconfirmed, anonymous, malformed and ordinary paid accounts fail closed', () => {
  assert.equal(collectiveRole(null),null);
  assert.equal(collectiveRole({...user,email_confirmed_at:null}),null);
  assert.equal(collectiveRole({...user,is_anonymous:true}),null);
  for (const value of [null, [], 'partner', {role:'admin',status:'active'}, {role:'member',status:'active'}])
    assert.equal(collectiveRole({...user,app_metadata:{hosting_collective:value}}),null);
  assert.equal(collectiveRole({...user,app_metadata:{plan:'plus'}}),null);
  const forged = {email_confirmed_at:'2026-10-31',app_metadata:{},user_metadata:{hosting_collective:{role:'partner',status:'active'}}};
  assert.equal(collectiveRole(forged),null);
});
