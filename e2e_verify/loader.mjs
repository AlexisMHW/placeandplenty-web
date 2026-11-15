// Node ESM loader: resolves "@/..." and swaps ONLY the Next runtime pieces (next/cache, next/headers, next/navigation) and the
// cookie-based supabase client (lib/supabase-server) for a client that talks to the LOCAL PostgREST with a locally signed JWT.
// Everything else (server actions, lib/*, validators, RPC argument building, error mapping) is the REAL web code.
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const h = (f) => path.join(root, "e2e_verify/stubs", f);
const stubs = {
  "next/cache": h("next-cache.mjs"), "next/headers": h("next-headers.mjs"), "next/navigation": h("next-navigation.mjs"),
  "@/lib/supabase-server": h("supabase-server.mjs"),
};
export async function resolve(spec, ctx, next) {
  if (stubs[spec]) return { url: pathToFileURL(stubs[spec]).href, shortCircuit: true };
  if (spec.startsWith("@/")) {
    const base = path.join(root, spec.slice(2));
    for (const ext of ["", ".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext) && /\.[a-z]+$/.test(base + ext) && !existsSync(base + ext + "/")) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
  }
  if ((spec.startsWith("./") || spec.startsWith("../")) && !/\.[a-z]+$/.test(spec) && ctx.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
