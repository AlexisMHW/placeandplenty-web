// Local-only bundling. Does not authenticate, register, upload or contact Canva.
import { build } from "esbuild";
import { stat, readFile, writeFile, unlink } from "node:fs/promises";
const backend = process.env.CANVA_BACKEND_URL || "http://localhost:3000";
const parsed = new URL(backend);
if (
  parsed.origin !== backend ||
  (parsed.protocol !== "https:" && parsed.hostname !== "localhost")
)
  throw new Error("Use an HTTPS backend origin (or localhost)");
await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  minify: true,
  outfile: "dist/app.js",
  format: "iife",
  target: "es2020",
  loader: { ".css": "css" },
  define: {
    "process.env.NODE_ENV": '"production"',
    BACKEND_URL: JSON.stringify(backend),
  },
});
// Canva uploads one JavaScript bundle: inline all generated UI kit CSS.
const css = await readFile("dist/app.css", "utf8");
const js = await readFile("dist/app.js", "utf8");
await writeFile(
  "dist/app.js",
  `(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);})();\n${js}`,
);
await unlink("dist/app.css");
const { size } = await stat("dist/app.js");
if (size > 5 * 1024 * 1024) throw new Error("Canva bundle exceeds 5 MB");
console.log(`Canva JS bundle: ${size} bytes; backend: ${backend}`);
