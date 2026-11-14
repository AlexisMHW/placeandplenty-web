// A8 acceptance helpers. Pure Node, no network, no DB. Run: node --test "tests/acceptance/**/*.acceptance.ts"
import fs from "node:fs";
import path from "node:path";
export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");
export const exists = (rel: string): boolean => fs.existsSync(path.join(ROOT, rel));
export function walk(rel: string, exts = [".ts", ".tsx"]): string[] {
  const out: string[] = [];
  const base = path.join(ROOT, rel);
  if (!fs.existsSync(base)) return out;
  const rec = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else if (exts.some((x) => p.endsWith(x))) out.push(path.relative(ROOT, p));
    }
  };
  rec(base);
  return out;
}
// A form posts a server action with the result DISCARDED: `await someAction(fd);` as a statement, not assigned/returned/used.
export function discardedActionResults(src: string): string[] {
  const hits: string[] = [];
  for (const m of src.matchAll(/action=\{async \(fd\) => \{ "use server"; (await [A-Za-z0-9_]+\(fd\);)(?: [^}]*)?\}\}/g)) hits.push(m[1]);
  return hits;
}
