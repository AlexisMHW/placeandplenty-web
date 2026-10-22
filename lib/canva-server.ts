import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { openGrant } from "./canva-security";

export function canvaConfig() {
  if (process.env.CANVA_PUBLISHER_ENABLED !== "true")
    throw new Error("Canva publisher disabled");
  const clientId = process.env.CANVA_OAUTH_CLIENT_ID;
  const redirectUri = process.env.CANVA_OAUTH_REDIRECT_URI;
  const encryptionKey = process.env.CANVA_TOKEN_ENCRYPTION_KEY;
  const clientSecret = process.env.CANVA_OAUTH_CLIENT_SECRET;
  const clientAuth = process.env.CANVA_OAUTH_CLIENT_AUTH || "secret";
  if (!["secret", "public"].includes(clientAuth))
    throw new Error("Invalid OAuth client authentication mode");
  const origin = process.env.CANVA_APP_ORIGIN;
  if (
    !clientId ||
    !redirectUri ||
    !encryptionKey ||
    (clientAuth === "secret" && !clientSecret) ||
    !origin
  )
    throw new Error("Canva configuration incomplete");
  if (new URL(origin).origin !== origin || !origin.startsWith("https://"))
    throw new Error("Invalid Canva origin");
  if (!redirectUri.startsWith("https://"))
    throw new Error("Invalid OAuth callback");
  return {
    clientId,
    redirectUri,
    encryptionKey,
    clientSecret,
    clientAuth,
    origin,
  };
}
export function anonymousClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function canvaClient(request: Request) {
  const config = canvaConfig();
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if (!token) throw new Error("Authentication required");
  const grant = openGrant(token, config.encryptionKey);
  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${grant.accessToken}` } },
    },
  );
  const { data, error } = await client.auth.getUser(grant.accessToken);
  if (error || data.user?.id !== grant.userId)
    throw new Error("Authentication required");
  return { client, userId: grant.userId };
}
export function canvaResponse(request: Request, body: unknown, status = 200) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Referrer-Policy": "no-referrer",
  };
  try {
    const { origin } = canvaConfig();
    if (request.headers.get("origin") === origin)
      headers["Access-Control-Allow-Origin"] = origin;
  } catch {}
  return Response.json(body, { status, headers });
}
export function canvaOptions(request: Request) {
  const response = canvaResponse(request, null);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Invitation-Opt-In",
  );
  return response;
}
