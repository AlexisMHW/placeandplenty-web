import { sql } from "./lib.mjs";
export const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
export const cnt = (q) => Number(sql(q));
