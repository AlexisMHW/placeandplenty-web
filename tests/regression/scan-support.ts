// Test support for the A8 web static scans (not imported by the app).
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

export const WEB_ROOT = join(import.meta.dirname, "../..");
const SKIP = new Set(["node_modules", ".next", ".git", "tests", "e2e", "public", "content", "tina"]);

export function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) out.push(...walk(p, exts)); continue; }
    if (/\.(backup|bak)|\.test\./.test(e.name)) continue;
    if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out.sort();
}
export const rel = (p: string) => relative(WEB_ROOT, p).split("\\").join("/");
export const read = (p: string) => readFileSync(p, "utf8");

export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

export function blankStrings(src: string): string {
  let out = ""; let q: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q === null) { if (c === "'" || c === '"' || c === "`") q = c; out += c; continue; }
    if (c === "\\") { out += "  "; i++; continue; }
    if (q === "`" && c === "$" && src[i + 1] === "{") {
      let d = 1; out += "${"; i += 2;
      while (i < src.length && d > 0) { if (src[i] === "{") d++; else if (src[i] === "}") d--; out += src[i]; i++; }
      i--; continue;
    }
    if (c === q) { q = null; out += c; continue; }
    out += c === "\n" ? "\n" : " ";
  }
  return out;
}

export function findCalls(src: string, re: RegExp): Array<{ line: number; args: string }> {
  const r = new RegExp(re.source, "g"); const out: Array<{ line: number; args: string }> = []; let m;
  while ((m = r.exec(src))) {
    let i = m.index + m[0].length, depth = 1, q: string | null = null; const start = i;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; }
      else if (c === "'" || c === '"' || c === "`") q = c;
      else if (c === "(") depth++; else if (c === ")") depth--;
      i++;
    }
    out.push({ line: src.slice(0, m.index).split("\n").length, args: src.slice(start, i - 1) });
  }
  return out;
}

export function identifierWords(expr: string): string[] {
  const ids = blankStrings(expr).match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return ids.flatMap((id) => id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().split(/\s+/)).filter(Boolean);
}
