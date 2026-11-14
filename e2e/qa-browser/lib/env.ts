// Reads configuration from the process environment, then from .env.local files. NEVER prints values.
import * as fs from 'fs';
import * as path from 'path';

// The ONLY Supabase project these tests may talk to. A different project (for example production) makes the suite refuse to run.
export const QA_PROJECT_REF = 'gpzlytukyvshrrxrmooo';

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function parseCredentialsFile(file: string): { email?: string; password?: string } {
  if (!file || !fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  const email = text.match(/^\s*email\s*:\s*(\S+)\s*$/im)?.[1];
  const password = text.match(/^\s*password\s*:\s*(\S+)\s*$/im)?.[1];
  return { email, password };
}

const root = path.resolve(__dirname, '..');
const merged: Record<string, string | undefined> = {
  ...parseEnvFile(path.resolve(root, '.env.local')),
  ...parseEnvFile(path.resolve(root, '..', '..', '.env.local')),
  ...process.env,
};

const creds = parseCredentialsFile(merged.QA_E2E_CREDENTIALS_FILE ?? '');

export const cfg = {
  baseUrl: (merged.QA_WEB_BASE_URL || 'http://localhost:3100').replace(/\/$/, ''),
  supabaseUrl: (merged.QA_SUPABASE_URL || merged.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''),
  anonKey: merged.QA_SUPABASE_ANON_KEY || merged.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  hostEmail: merged.QA_E2E_HOST_EMAIL || creds.email || '',
  hostPassword: merged.QA_E2E_HOST_PASSWORD || creds.password || '',
  // A second disposable QA account that is NOT staff, used for the Command Center denial test. Optional.
  nonStaffEmail: merged.QA_E2E_NONSTAFF_EMAIL || '',
  nonStaffPassword: merged.QA_E2E_NONSTAFF_PASSWORD || '',
  // "stub" = self-check against a local fake backend (suite soundness only, proves nothing about QA).
  mode: (merged.QA_E2E_MODE || 'qa') as 'qa' | 'stub',
};

export function supabaseRef(url: string): string | null {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1].toLowerCase() : null;
}

/** Refuse to run against anything but the QA project. Throws a plain-English message that contains no secret. */
export function assertQaOnly(): void {
  if (cfg.mode === 'stub') return;
  const ref = supabaseRef(cfg.supabaseUrl);
  if (ref !== QA_PROJECT_REF) {
    throw new Error(
      'STOP: QA_SUPABASE_URL is missing or is not the QA project. These tests only run against the QA project. Nothing was run.'
    );
  }
  if (!cfg.anonKey) throw new Error('STOP: QA_SUPABASE_ANON_KEY is missing. Nothing was run.');
}

export const haveHostLogin = () => Boolean(cfg.hostEmail && cfg.hostPassword);
