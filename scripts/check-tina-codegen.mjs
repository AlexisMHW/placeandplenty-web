// Runs immediately after `tinacms build`, before `next build`.
//
// Why this exists (see website directive §23 — "Tina CMS: known
// deployment trap"): when Tina's codegen cannot find its own generated
// .gql documents, it swallows the error and emits an EMPTY getSdk().
// The build then dies several steps later inside lib/tina-content.ts
// with "Property 'postConnection' does not exist on type '{}'" — which
// reads like a bug in the page you just edited, and is not.
//
// The known trigger is an absolute project path containing characters
// fast-glob treats as metacharacters — parentheses especially, e.g. a
// folder named "placeandplenty-web (2)". Vercel clones into a clean
// path, so this fails locally and passes in CI, which makes it even
// easier to misdiagnose.
//
// This check can only turn a failure that was going to happen anyway
// into one that says what is actually wrong.

import { readFileSync } from "node:fs";

const TYPES = "tina/__generated__/types.ts";

let source;
try {
  source = readFileSync(TYPES, "utf8");
} catch {
  fail(`${TYPES} was not generated at all.`);
}

// A populated SDK has one method per operation in queries.gql. An empty
// one is literally `return {\n  \n};`.
const sdk = source.match(/export function getSdk<C>\(requester: Requester<C>\) \{\s*return \{([\s\S]*?)\n {4}\};/);

if (!sdk) {
  fail(`Could not find getSdk() in ${TYPES}. Tina's codegen output changed shape.`);
}

if (!/\w+\s*\(/.test(sdk[1])) {
  fail(
    "Tina generated an EMPTY GraphQL SDK — it found none of its own .gql documents.\n\n" +
      `  Project path: ${process.cwd()}\n\n` +
      "  Almost always this is the path itself. fast-glob, which Tina uses to\n" +
      "  locate tina/__generated__/*.gql, cannot match an absolute path\n" +
      "  containing parentheses or other glob metacharacters.\n\n" +
      "  Fix: move the project to a path with no parentheses or brackets —\n" +
      "  e.g. C:\\Users\\you\\code\\placeandplenty-web — then reinstall and rebuild.\n\n" +
      "  This is NOT a bug in whatever page you last edited."
  );
}

console.log("Tina codegen check: SDK generated with methods. OK.");

function fail(message) {
  console.error(`\nTina codegen check FAILED.\n\n  ${message}\n`);
  process.exit(1);
}
