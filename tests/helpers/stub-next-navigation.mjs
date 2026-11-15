// Test stub for next/navigation: notFound/redirect throw like Next does (with a digest), so gates can be asserted.
export function notFound() { const e = new Error("NEXT_NOT_FOUND"); e.digest = "NEXT_NOT_FOUND"; throw e; }
export function redirect(url) { const e = new Error("NEXT_REDIRECT"); e.digest = `NEXT_REDIRECT;${url}`; throw e; }
