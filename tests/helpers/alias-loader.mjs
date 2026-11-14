// Test-only module loader: resolves the "@/..." alias and stubs Next/Supabase server modules so the REAL
// server-action files can be imported and exercised under `node --test` against a fake Supabase client.
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stubs = {
  "next/cache": path.join(root, "tests/helpers/stub-next-cache.mjs"),
  "next/headers": path.join(root, "tests/helpers/stub-next-headers.mjs"),
  "@/lib/supabase-server": path.join(root, "tests/helpers/stub-supabase-server.mjs"),
};

export async function resolve(specifier, context, next) {
  if (stubs[specifier]) return { url: pathToFileURL(stubs[specifier]).href, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + ext) && !base.endsWith("/") && (ext !== "" || /\.[a-z]+$/.test(base))) {
        return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-z]+$/.test(specifier) && context.parentURL?.startsWith("file:")) {
    const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
