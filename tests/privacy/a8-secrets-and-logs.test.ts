// A8 privacy: server-only secrets stay server-side, and logs carry no PII or tokens.
import test from "node:test";
import assert from "node:assert/strict";
import { WEB_ROOT, walk, read, rel, stripComments, findCalls, identifierWords } from "../regression/scan-support.ts";
import { join } from "node:path";

const files = ["app", "lib", "components", "middleware.ts"].flatMap((d) => (d.endsWith(".ts") ? [join(WEB_ROOT, d)] : walk(join(WEB_ROOT, d), [".ts", ".tsx"])));
const isClient = (src: string) => /^\s*["']use client["']/.test(src);

test("client components and browser modules never read server-only env vars", () => {
  const bad: string[] = [];
  for (const f of files) {
    const src = read(f);
    if (!isClient(src) && !/supabase-browser/.test(f)) continue;
    for (const m of stripComments(src).matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!/^NEXT_PUBLIC_/.test(m[1]) && m[1] !== "NODE_ENV") bad.push(`${rel(f)}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("the service-role key is referenced only by server-only files", () => {
  const ALLOWED = [/^app\/api\//, /^app\/r\/\[code\]\/route\.ts$/, /^lib\/hc\/dispatch-server\.ts$/, /^lib\/supabase-server/, /^lib\/admin\//];
  const bad = files.filter((f) => /SERVICE_ROLE|service_role/.test(stripComments(read(f))) && !ALLOWED.some((a) => a.test(rel(f)))).map(rel);
  assert.deepEqual(bad, []);
  for (const f of files.filter((x) => /SERVICE_ROLE/.test(read(x)))) assert.equal(isClient(read(f)), false, `${rel(f)} is a client module`);
});

test("NEXT_PUBLIC_ names do not look like secrets", () => {
  const names = new Set<string>();
  for (const f of files) for (const m of stripComments(read(f)).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) names.add(m[0]);
  const ok = new Set(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  assert.deepEqual([...names].filter((n) => /SECRET|PRIVATE|SERVICE|PASSWORD|WEBHOOK|ADMIN/.test(n) || (/_KEY$/.test(n) && !ok.has(n))), []);
});

const PII = new Set(["email", "emails", "phone", "phones", "password", "passcode", "token", "tokens", "secret", "authorization", "bearer", "jwt", "otp", "address", "apikey", "cookie", "cookies", "recipient", "shipping"]);
const WHOLE = /^(session|user|profile|guest|guests|contact|contacts|payload|headers|credentials|req|request|formData|created|order|customer|recipient)$/;
// file -> args regex -> reason. DEFECT entries are tracked in A8_DEFECTS.md and must be fixed by the owner, then removed here.
const ALLOWED: Array<{ file: RegExp; args: RegExp; why: string }> = [
  { file: /^lib\/analytics\.ts$/, args: /"\[analytics\]", event, cleanMeta/, why: "dev-only, and meta already scrubbed by scrubEventProperties" },
  { file: /^app\/api\/paper-suite\/fulfill\/route\.ts$/, args: /"Gelato order response missing id", created/, why: "DEFECT A8-W1: logs the whole Gelato order response (recipient name/address/email)" },
];

test("no console call logs an email, phone, token, password, address, or a whole customer/order/session object", () => {
  const hits: string[] = [];
  for (const f of files) {
    const src = stripComments(read(f));
    for (const c of findCalls(src, /\bconsole\.(?:log|info|warn|error|debug|trace)\s*\(/)) {
      const bad = identifierWords(c.args).filter((w) => PII.has(w));
      const whole = c.args.split(/,(?![^()]*\))/).map((a) => a.trim()).some((a) => WHOLE.test(a));
      if (!bad.length && !whole) continue;
      if (ALLOWED.some((a) => a.file.test(rel(f)) && a.args.test(c.args.replace(/\s+/g, " ").trim()))) continue;
      hits.push(`${rel(f)}:${c.line} ${c.args.trim().slice(0, 100)}`);
    }
  }
  assert.deepEqual(hits, []);
});

test("scanner self-test", () => {
  const w = (code: string) => findCalls(code, /\bconsole\.log\s*\(/).flatMap((c) => identifierWords(c.args)).filter((x) => PII.has(x));
  assert.ok(w("console.log('x', guest.email)").includes("email"));
  assert.deepEqual(w("console.log('contact email failed', err.message)"), []);
});
