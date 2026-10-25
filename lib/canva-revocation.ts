import type { SupabaseClient } from "@supabase/supabase-js";
import { digest } from "./canva-security.ts";
export class CanvaRevocationUnavailable extends Error {}
export async function assertCanvaGrantActive(
  client: SupabaseClient,
  token: string,
) {
  const { data, error } = await client.rpc("is_canva_grant_revoked", {
    p_token_hash: digest(token),
  });
  // Unknown state fails closed. Only an explicit false permits access.
  if (error || typeof data !== "boolean")
    throw new CanvaRevocationUnavailable("Connection verification unavailable");
  if (data) throw new Error("Authentication required");
}
export async function revokeCanvaGrant(
  client: SupabaseClient,
  token: string,
  expiresAt: number,
) {
  const { data, error } = await client.rpc("revoke_canva_grant", {
    p_token_hash: digest(token),
    p_expires_at: new Date(expiresAt).toISOString(),
  });
  if (error || data !== true)
    throw new CanvaRevocationUnavailable("Revocation unavailable");
}
