import { createClient } from "@supabase/supabase-js";
import { canvaConfig } from "@/lib/canva-server";
import { openGrant } from "@/lib/canva-security";
import { readCanvaBody, CanvaBodyTooLarge } from "@/lib/canva-request";
import { oauthClientAuthorized } from "@/lib/canva-oauth-client";
import { revokeCanvaGrant } from "@/lib/canva-revocation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  try {
    const config = canvaConfig();
    const body = new URLSearchParams(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await readCanvaBody(request, 8192),
      ),
    );
    if (!oauthClientAuthorized(request.headers, body, config))
      return Response.json(
        { error: "invalid_client" },
        { status: 401, headers },
      );
    const token = body.get("token");
    if (!token || body.getAll("token").length !== 1)
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers },
      );
    let grant;
    try {
      grant = openGrant(token, config.encryptionKey);
    } catch {
      // RFC 7009: unknown, tampered and expired tokens have identical responses.
      return new Response(null, { status: 200, headers });
    }
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${grant.accessToken}` } },
      },
    );
    // This operation only removes access. The user's JWT binds the private
    // revocation to auth.uid(); no service-role credential is involved.
    await revokeCanvaGrant(client, token, grant.expiresAt);
    return new Response(null, { status: 200, headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CanvaBodyTooLarge || error instanceof TypeError
            ? "invalid_request"
            : "temporarily_unavailable",
      },
      {
        status:
          error instanceof CanvaBodyTooLarge || error instanceof TypeError
            ? 400
            : 503,
        headers,
      },
    );
  }
}
