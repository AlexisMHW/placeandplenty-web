// Fake Supabase client that records every attempted WRITE so tests can prove nothing was written.
export interface FakeOptions {
  status: string | null;            // value effective_gathering_status returns (null => error)
  statusError?: boolean;
  userId?: string;                  // caller identity (owner / co-host / anyone)
  staffContext?: unknown;           // get_my_staff_context answer (Command Center gate tests)
  photoWorkspace?: { expiresAt: string; editable?: boolean; effectiveStatus?: string } | null; // gathering_photo_workspace answer (null => no answer)
}
export function makeFakeSupabase(opts: FakeOptions) {
  const calls: { kind: string; name: string; args?: unknown }[] = [];
  const result = (data: unknown = null) => ({ data, error: null, count: null });
  const chain = (table: string): any => {
    const c: any = {
      select: () => c, eq: () => c, neq: () => c, in: () => c, is: () => c, order: () => c, limit: () => c,
      single: async () => result(null), maybeSingle: async () => result(null),
      insert: (v: unknown) => { calls.push({ kind: "write", name: `${table}.insert`, args: v }); return c; },
      update: (v: unknown) => { calls.push({ kind: "write", name: `${table}.update`, args: v }); return c; },
      upsert: (v: unknown) => { calls.push({ kind: "write", name: `${table}.upsert`, args: v }); return c; },
      delete: () => { calls.push({ kind: "write", name: `${table}.delete` }); return c; },
      then: (res: (v: unknown) => unknown) => Promise.resolve(result([])).then(res),
    };
    return c;
  };
  const client: any = {
    calls,
    auth: { getUser: async () => ({ data: { user: opts.userId ? { id: opts.userId, email: "caller@example.test" } : null }, error: null }) },
    from: (t: string) => chain(t),
    rpc: async (fn: string, args: unknown) => {
      if (fn === "effective_gathering_status") {
        calls.push({ kind: "status", name: fn, args });
        if (opts.statusError || opts.status === null) return { data: null, error: { message: "boom" } };
        return { data: opts.status, error: null };
      }
      if (fn === "resolve_gathering_is_premium") return { data: true, error: null };
      if (fn === "get_my_staff_context") { calls.push({ kind: "read", name: `rpc:${fn}` }); return { data: opts.staffContext ?? null, error: null }; }
      if (fn === "gathering_photo_workspace") {
        calls.push({ kind: "write", name: `rpc:${fn}`, args }); // classified as a READ by the tests (READ_RPCS)
        const w = opts.photoWorkspace;
        return { data: w ? { effectiveStatus: w.effectiveStatus ?? opts.status, expiresAt: w.expiresAt, editable: w.editable ?? true } : null, error: null };
      }
      calls.push({ kind: "write", name: `rpc:${fn}`, args });
      return { data: null, error: null };
    },
    storage: { from: (b: string) => ({
      upload: async (p: string) => { calls.push({ kind: "write", name: `storage:${b}.upload`, args: p }); return { data: null, error: null }; },
      remove: async () => { calls.push({ kind: "write", name: `storage:${b}.remove` }); return { data: null, error: null }; },
      createSignedUrl: async () => ({ data: { signedUrl: "https://x.test/s" }, error: null }),
    }) },
    functions: { invoke: async (fn: string) => { calls.push({ kind: "write", name: `fn:${fn}` }); return { data: null, error: null }; } },
  };
  return client;
}
