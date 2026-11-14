// Fake "Supabase" used ONLY for the sandbox self-check of the suite (QA_E2E_MODE=stub). It proves the tests' mechanics, not QA behavior.
const http = require('http');
const PORT = Number(process.env.STUB_PORT || 54999);
http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    if (req.url.startsWith('/auth/v1/token')) { res.writeHead(400, cors); return res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' })); }
    if (req.url.startsWith('/auth/v1/user')) {
      if ((req.headers.authorization || '').includes('STUBSESSION')) { res.writeHead(200, cors); return res.end(JSON.stringify({ id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'stub-host@example.invalid', app_metadata: {}, user_metadata: { first_name: 'Stub' }, created_at: '2026-01-01T00:00:00Z' })); }
      res.writeHead(401, cors); return res.end(JSON.stringify({ msg: 'no session' }));
    }
    if (req.url.startsWith('/functions/v1/')) { res.writeHead(404, cors); return res.end(JSON.stringify({ error: 'not_found' })); }
    res.writeHead(200, cors); res.end('[]');
  });
}).listen(PORT, '127.0.0.1', () => console.log('stub backend on', PORT));
