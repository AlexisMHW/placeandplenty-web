// Opt-in integration verification. Never run against production.
// Requires the owner-approved QA branch, a local QA server and private fixture
// credentials outside the repository. Retains synthetic QA artwork for review.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { digest, sealGrant } from '../lib/canva-security.ts';

const qaUrl = 'https://edfqrmkrfqnovzrryrxa.supabase.co';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, qaUrl, 'QA project guard');
const base = process.env.CANVA_QA_BASE_URL || 'http://localhost:3100';
assert.ok(['http://localhost:3100', 'https://canva-qa.placeandplenty.com'].includes(new URL(base).origin), 'Exact QA server guard');
assert.ok(process.env.CANVA_QA_FIXTURES, 'Private fixtures path required');
const fixtures = JSON.parse(await readFile(process.env.CANVA_QA_FIXTURES, 'utf8'));
const origin = 'https://app-aahogo4rp4c.canva-apps.com';
const clients = {}, sessions = {};
let passed = 0;
function check(label, fn) { fn(); passed++; console.log(`PASS ${label}`); }
for (const [name, user] of Object.entries(fixtures.users)) {
  const client = createClient(qaUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.signInWithPassword({ email: user.email, password: fixtures.password });
  assert.equal(result.error, null, `QA ${name} sign-in failed`);
  clients[name] = client;
  sessions[name] = result.data.session;
}
check('real QA account sign-ins', () => assert.equal(Object.keys(sessions).length, 3));
const gatheringId = fixtures.gatheringId;
const { data: existing, error: readError } = await clients.owner.from('gatherings').select('id').eq('id', gatheringId).maybeSingle();
assert.equal(readError, null);
if (!existing) {
  const { error } = await clients.owner.from('gatherings').insert({
    id: gatheringId, owner_user_id: fixtures.users.owner.id, name: 'Canva QA invitation transfer',
    gathering_type: 'dinner', gathering_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), arrival_time: '18:00',
  });
  assert.equal(error, null, 'Canonical gathering creation failed');
  const member = await clients.owner.from('gathering_members').insert({
    gathering_id: gatheringId, user_id: fixtures.users.cohost.id,
    invited_email: fixtures.users.cohost.email, status: 'accepted',
  });
  assert.equal(member.error, null, 'QA cohost fixture failed');
}
const grantFor = name => sealGrant({ userId: fixtures.users[name].id, accessToken: sessions[name].access_token, expiresAt: Date.now() + 300000 }, process.env.CANVA_TOKEN_ENCRYPTION_KEY);
async function request(path, token, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  let body;
  try { body = await response.json(); } catch { throw new Error(`Non-JSON QA response (${response.status}) at ${path.split('?')[0]}`); }
  return { response, body };
}
let result = await request('/api/canva/gatherings');
check('unauthenticated request denied', () => assert.equal(result.response.status, 401));
const verifier = randomBytes(32).toString('base64url');
const state = randomBytes(20).toString('base64url');
const oauthParams = new URLSearchParams({ client_id: 'place-and-plenty-canva-qa', redirect_uri: 'https://www.canva.com/apps/oauth/authorized', response_type: 'code', code_challenge_method: 'S256', code_challenge: digest(verifier), state, scope: 'gatherings:read invitation:write' });
const authorizePath = '/host/canva/authorize?' + oauthParams;
const loginGate = await fetch(base + authorizePath, { redirect: 'manual' });
check('existing login carries the exact OAuth return path', () => {
  assert.equal(loginGate.status, 307);
  const login = new URL(loginGate.headers.get('location'), base);
  assert.equal(login.pathname, '/login'); assert.equal(login.searchParams.get('next'), authorizePath);
});
let code;
if (process.env.CANVA_QA_VERIFY_CONSENT === 'true') {
let cookieJar = [];
const ssr = createServerClient(qaUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => cookieJar, setAll: cookies => { cookieJar = cookies; } },
});
const ssrLogin = await ssr.auth.signInWithPassword({ email: fixtures.users.owner.email, password: fixtures.password });
assert.equal(ssrLogin.error, null);
assert.ok(cookieJar.length, 'SSR sign-in produced no session cookies');
const ssrUser = await ssr.auth.getUser();
assert.equal(ssrUser.data.user?.id, fixtures.users.owner.id, 'SSR test client session validation failed');
const cookie = cookieJar.map(c => c.name + '=' + c.value).join('; ');
const consentResponse = await fetch(base + authorizePath, { headers: { Cookie: cookie }, redirect: 'manual' });
const consent = await consentResponse.text();
check('signed-in host sees explicit consent', () => { assert.equal(consentResponse.status, 200); assert.ok(consent.includes('Allow connection')); assert.ok(consent.includes(fixtures.users.owner.email)); });
const form = new FormData();
const unescape = text => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
for (const input of consent.matchAll(/<input\b[^>]*>/g)) {
  const name = input[0].match(/\bname="([^"]*)"/), value = input[0].match(/\bvalue="([^"]*)"/);
  if (name && unescape(name[1]).startsWith('$ACTION_')) form.append(unescape(name[1]), unescape(value?.[1] || ''));
}
assert.ok([...form.keys()].length, 'Consent action fields missing');
const allowed = await fetch(base + authorizePath, { method: 'POST', headers: { Cookie: cookie, Origin: base }, body: form, redirect: 'manual' });
check('explicit consent issues code to exact Canva callback', () => { assert.equal(allowed.status, 303); });
const callback = new URL(allowed.headers.get('location'), base);
assert.equal(callback.origin + callback.pathname, 'https://www.canva.com/apps/oauth/authorized');
assert.equal(callback.searchParams.get('state'), state);
code = callback.searchParams.get('code');
assert.ok(code);
} else {
  // Some restricted runtimes cannot make external requests from Edge middleware.
  // Default API mode exercises real Auth, PostgREST and Storage but does not claim
  // that the browser consent boundary was verified.
  code = randomBytes(32).toString('base64url');
  const insert = await clients.owner.rpc('issue_canva_authorization_code', {
    p_code_hash: digest(code), p_code_challenge: digest(verifier),
    p_encrypted_grant: grantFor('owner'),
  });
  assert.equal(insert.data?.status, 'issued');
  assert.equal(insert.error, null, 'User-bound authorization code insertion failed');
  console.log('NOT VERIFIED: signed-in browser consent; use CANVA_QA_VERIFY_CONSENT=true in an unrestricted QA runtime.');
}
const exchangeBody = v => new URLSearchParams({ client_id: 'place-and-plenty-canva-qa', grant_type: 'authorization_code', redirect_uri: 'https://www.canva.com/apps/oauth/authorized', code, code_verifier: v });
result = await request('/api/canva/token', null, { method: 'POST', body: exchangeBody(randomBytes(32).toString('base64url')) });
check('wrong PKCE verifier denied over HTTP', () => assert.equal(result.response.status, 400));
result = await request('/api/canva/token', null, { method: 'POST', body: exchangeBody(verifier) });
check('public client token exchange with PKCE', () => { assert.equal(result.response.status, 200); assert.equal(result.body.token_type, 'Bearer'); assert.ok(result.body.expires_in > 0 && result.body.expires_in <= 600); });
const ownerGrant = result.body.access_token;
result = await request('/api/canva/token', null, { method: 'POST', body: exchangeBody(verifier) });
check('authorization code replay denied over HTTP', () => assert.equal(result.response.status, 400));
result = await request('/api/canva/gatherings', ownerGrant);
check('owner sees authorized gathering and exact-origin CORS', () => { assert.equal(result.response.status, 200); assert.ok(result.body.gatherings.some(g => g.id === gatheringId)); assert.equal(result.response.headers.get('access-control-allow-origin'), origin); });
result = await request('/api/canva/gatherings', grantFor('stranger'));
check('stranger cannot select owner gathering', () => { assert.equal(result.response.status, 200); assert.ok(!result.body.gatherings.some(g => g.id === gatheringId)); });
result = await request('/api/canva/gatherings', ownerGrant, { headers: { Origin: 'https://unrelated.example' } });
check('unrelated origin receives no CORS authorization', () => assert.equal(result.response.headers.get('access-control-allow-origin'), null));
const wrongIdentity = sealGrant({ userId: fixtures.users.stranger.id, accessToken: sessions.owner.access_token, expiresAt: Date.now() + 60000 }, process.env.CANVA_TOKEN_ENCRYPTION_KEY);
result = await request('/api/canva/gatherings', wrongIdentity);
check('grant identity must match validated Supabase user', () => assert.equal(result.response.status, 401));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
const path = `/api/canva/publish?gatheringId=${gatheringId}`;
const publishOptions = { method: 'POST', body: png, headers: { 'Content-Type': 'image/png', 'X-Invitation-Opt-In': 'true', 'X-Publish-Request-Id': randomUUID() } };
result = await request(path, ownerGrant, { ...publishOptions, headers: { 'Content-Type': 'image/png' } });
check('explicit invitation opt-in required', () => assert.equal(result.response.status, 400));
result = await request(path, ownerGrant, { ...publishOptions, body: Buffer.from('invalid') });
check('invalid PNG rejected', () => assert.equal(result.response.status, 400));
const damagedPng = Buffer.from(png);
damagedPng[45] ^= 1;
result = await request(path, ownerGrant, { ...publishOptions, body: damagedPng });
check('damaged PNG checksum rejected', () => assert.equal(result.response.status, 400));
result = await request(path, ownerGrant, { ...publishOptions, body: png.subarray(0, -12) });
check('PNG without final chunk rejected', () => assert.equal(result.response.status, 400));
const oversizedToken = await fetch(base + '/api/canva/token', { method: 'POST', body: 'x'.repeat(8193), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
check('oversized token body rejected', () => assert.equal(oversizedToken.status, 400));

result = await request(path, grantFor('stranger'), publishOptions);
check('stranger artwork transfer denied', () => assert.equal(result.response.status, 400));
result = await request(path, ownerGrant, publishOptions);
check('owner artwork transfer completes', () => { assert.equal(result.response.status, 200); assert.equal(result.body.status, 'completed'); });
async function savedArtwork() {
  const { data, error } = await clients.owner.rpc('list_my_gatherings_with_lifecycle').eq('id', gatheringId).single();
  assert.equal(error, null); assert.ok(data.invitation_artwork_path?.startsWith(gatheringId + '/')); return data.invitation_artwork_path;
}
const firstPath = await savedArtwork();
result = await request(path, ownerGrant, publishOptions);
check('same request replay completes without replacing canonical artwork', () => assert.equal(result.response.status, 200));
assert.equal(await savedArtwork(), firstPath);
const firstDownload = await clients.owner.storage.from('invitation-artwork').download(firstPath);
check('canonical artwork is readable and byte-identical', () => { assert.equal(firstDownload.error, null); });
assert.deepEqual(Buffer.from(await firstDownload.data.arrayBuffer()), png);
result = await request(path, grantFor('cohost'), publishOptions);
check('accepted cohost artwork transfer completes', () => assert.equal(result.response.status, 200));
const secondPath = await savedArtwork();
assert.notEqual(firstPath, secondPath);
const preserved = await clients.owner.storage.from('invitation-artwork').download(firstPath);
check('replacement preserves prior artwork object', () => assert.equal(preserved.error, null));
const strangerDownload = await clients.stranger.storage.from('invitation-artwork').download(secondPath);
check('private artwork cannot be downloaded by stranger', () => assert.ok(strangerDownload.error));
const simultaneous = await Promise.all([request(path, ownerGrant, {...publishOptions, headers: {...publishOptions.headers, 'X-Publish-Request-Id': randomUUID()}}), request(path, grantFor('cohost'), {...publishOptions, headers: {...publishOptions.headers, 'X-Publish-Request-Id': randomUUID()}})]);
check('concurrent replacements complete without deleting prior artwork', () => assert.ok(simultaneous.every(r => r.response.status === 200)));
await savedArtwork();
const concurrentId = randomUUID();
const concurrentOptions = {...publishOptions, headers: {...publishOptions.headers, 'X-Publish-Request-Id': concurrentId}};
const duplicate = await Promise.all([request(path, ownerGrant, concurrentOptions), request(path, ownerGrant, concurrentOptions)]);
check('concurrent identical requests produce one save or a safe in-progress response', () => {
  assert.ok(duplicate.some(r => r.response.status === 200));
  assert.ok(duplicate.every(r => [200,409].includes(r.response.status)));
});
const duplicatePath = await savedArtwork();
result = await request(path, ownerGrant, concurrentOptions);
check('completed concurrent request replay preserves its artwork path', () => assert.equal(result.response.status, 200));
assert.equal(await savedArtwork(), duplicatePath);
const conflict = await clients.owner.rpc('begin_canva_publish', {p_request_id: concurrentId, p_gathering_id: gatheringId, p_content_hash: '0'.repeat(64)});
check('changed content cannot reuse a completed request ID', () => {assert.equal(conflict.error,null); assert.equal(conflict.data?.status,'conflict');});
console.log(`Verified ${passed} QA checks. Synthetic fixtures and artwork retained in QA only. No production requests.`);
