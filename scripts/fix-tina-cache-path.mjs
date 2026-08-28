// Runs immediately after `tinacms build`, before `next build`.
// No-op on POSIX. On Windows it repairs one line of generated code.
//
// THE BUG (tinacms 2.x, node-cache):
//
//   const pathParts = dir.split(path.sep).filter(Boolean);
//   const cacheHash = pathParts[pathParts.length - 1];
//   const rootUser  = pathParts[0];
//   let cacheDir = dir;
//   if (!fs.existsSync(path.join(path.sep, rootUser))) {
//     cacheDir = path.join(os.tmpdir(), cacheHash);
//   }
//
// Tina writes `cacheDir` into tina/__generated__/client.ts with FORWARD
// slashes on every platform. On Windows `path.sep` is "\", so
// `dir.split(path.sep)` does not split at all: it returns one element,
// the whole path. `cacheHash` and `rootUser` both become that whole
// path, `path.join("\\", "C:/Users/...")` does not exist, and the
// fallback computes
//
//   path.join(os.tmpdir(), "C:/Users/travi/.../.cache/1787950310666")
//   => C:\Users\travi\AppData\Local\Temp\C:\Users\travi\...
//
// which is not a legal Windows path. mkdirSync throws ENOENT and Tina
// rethrows it as "Failed to create cache directory".
//
// WHY IT MATTERS, given the build still exits 0. Next catches the throw
// inside generateStaticParams and carries on, so `next build` succeeds
// while silently prerendering ZERO article routes. Locally every Tina
// -backed dynamic route quietly degrades to on-demand rendering, and a
// broken slug cannot be caught before it ships. Vercel is unaffected:
// path.sep is "/" there, the split works, and the paths agree.
//
// The fix is to hand Tina a cacheDir already written in the platform's
// own separator, so the split behaves and `cacheDir` stays as-is.
//
// Deliberately narrow: one regex, one file, Windows only, verified
// present before writing. If a future tinacms release fixes the split,
// this becomes a no-op and the ONLY visible sign is the notice below —
// at which point delete this script and its package.json entry.

import { readFileSync, writeFileSync } from "node:fs";
import { sep } from "node:path";

const CLIENT = "tina/__generated__/client.ts";
const BACKSLASH = String.fromCharCode(92);

if (sep === "/") {
  console.log("Tina cache path: POSIX, nothing to do. OK.");
  process.exit(0);
}

let source;
try {
  source = readFileSync(CLIENT, "utf8");
} catch {
  console.error(
    `\nTina cache path FAILED.\n\n  ${CLIENT} was not generated.\n` +
      "  Run `tinacms build` first — it is the step before this one.\n"
  );
  process.exit(1);
}

const match = source.match(/cacheDir:\s*'([^']+)'/);

if (!match) {
  // Either Tina stopped emitting cacheDir or it changed shape. Say so
  // and pass: a missing workaround must not block a build that the
  // upstream fix would have made correct anyway.
  console.log(
    "Tina cache path: no cacheDir in the generated client — " +
      "nothing to repair (upstream may have fixed this). OK."
  );
  process.exit(0);
}

const original = match[1];

if (!original.includes("/")) {
  // Already backslashed (and, being read back out of source, already
  // escaped). Re-running is a no-op rather than a double-escape.
  console.log("Tina cache path: already platform-native. OK.");
  process.exit(0);
}

const repaired = original.split("/").join(sep);

// The value is being written back into a single-quoted TypeScript string
// literal, so every backslash has to be escaped for the SOURCE, not just
// swapped in the path. Writing C:\Users\... raw produces the invalid
// escape \U and turns \tina into a tab character — webpack then fails
// with a bare "Syntax Error" pointing at whichever page imported the
// client, which is exactly the misdiagnosis §23 warns about.
const literal = repaired.split(BACKSLASH).join(BACKSLASH + BACKSLASH);

writeFileSync(
  CLIENT,
  source.replace(`cacheDir: '${original}'`, `cacheDir: '${literal}'`)
);

console.log(
  `Tina cache path: rewrote cacheDir to Windows separators so ` +
    `generateStaticParams can prerender. OK.`
);
