// Server-only production wiring for lib/hc/dispatch-runner.ts. Imported by the review server action and the dispatch route.
// The Supabase client is created lazily and only when the dispatch flag is on. The provider is the disabled one: no real provider exists here.
import { createClient } from "@supabase/supabase-js";
import { createDisabledProvider } from "../comms/provider.ts";
import { runHcDispatch } from "./dispatch-runner.ts";
import type { DispatchSummary } from "./events.ts";

export function runConfiguredHcDispatch(): Promise<DispatchSummary> {
  return runHcDispatch({
    env: process.env,
    provider: createDisabledProvider(),
    serviceClient: () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
    },
  });
}
