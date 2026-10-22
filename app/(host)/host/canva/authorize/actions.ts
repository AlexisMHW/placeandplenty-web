"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { canvaConfig } from "@/lib/canva-server";
import {
  digest,
  GRANT_SECONDS,
  sealGrant,
  validateOAuthRequest,
} from "@/lib/canva-security";

export async function authorizeCanva(raw: string) {
  const config = canvaConfig();
  const request = validateOAuthRequest(new URLSearchParams(raw), config);
  const client = createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Please sign in again");
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session || session.user.id !== user.id)
    throw new Error("Please sign in again");
  const expiresAt = Math.min(
    Date.now() + GRANT_SECONDS * 1000,
    (session.expires_at || 0) * 1000,
  );
  if (expiresAt <= Date.now() + 30000)
    throw new Error("Please refresh your session");
  const code = randomBytes(32).toString("base64url");
  const { error: insertError } = await client
    .from("canva_authorization_codes")
    .insert({
      code_hash: digest(code),
      user_id: user.id,
      code_challenge: request.challenge,
      encrypted_grant: sealGrant(
        { userId: user.id, accessToken: session.access_token, expiresAt },
        config.encryptionKey,
      ),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
  if (insertError)
    throw new Error("Canva connection is unavailable. Please try again later.");
  const target = new URL(request.redirectUri);
  target.searchParams.set("code", code);
  target.searchParams.set("state", request.state);
  redirect(target.toString());
}
