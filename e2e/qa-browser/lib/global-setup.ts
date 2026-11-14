// Runs once before any test. Stops the whole run unless it is certain only the QA project is involved.
import { cfg, assertQaOnly, supabaseRef, QA_PROJECT_REF } from './env';

export default async function globalSetup() {
  assertQaOnly();
  if (cfg.mode === 'stub') return;

  // Look inside the web app's own JavaScript for any Supabase address. Every one must be the QA project.
  const res = await fetch(cfg.baseUrl + '/login');
  if (!res.ok) throw new Error(`STOP: the web app at ${cfg.baseUrl} did not answer /login (HTTP ${res.status}).`);
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => new URL(m[1], cfg.baseUrl).toString());
  const found = new Set<string>();
  for (const body of [html, ...(await Promise.all(scripts.slice(0, 40).map((s) => fetch(s).then((r) => r.text()).catch(() => ''))))]) {
    for (const m of body.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/gi)) found.add(m[1].toLowerCase());
  }
  const wrong = [...found].filter((r) => r !== QA_PROJECT_REF);
  if (wrong.length) throw new Error('STOP: the web app under test refers to a Supabase project that is not QA. Nothing was run.');
  if (!found.has(QA_PROJECT_REF) && supabaseRef(cfg.supabaseUrl) === QA_PROJECT_REF) {
    // Page may keep the address only in server code; keep going but say so in the log.
    console.log('NOTE: could not read the Supabase address from the page scripts; relying on the environment you supplied.');
  }
}
