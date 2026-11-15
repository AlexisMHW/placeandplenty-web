// Maps Supabase-style /rest/v1/* onto a bare local PostgREST. 127.0.0.1 only.
import http from "node:http";
http.createServer((req, res) => {
  const p = http.request({ host: "127.0.0.1", port: 54480, method: req.method, path: req.url.replace(/^\/rest\/v1/, "") || "/", headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on("error", () => { res.writeHead(502); res.end(); }); req.pipe(p);
}).listen(54481, "127.0.0.1");
