import { anonymousClient, canvaConfig } from "@/lib/canva-server";
import {
  digest,
  equalSecret,
  openGrant,
  validVerifier,
} from "@/lib/canva-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  try {
    const config = canvaConfig();
    if (Number(request.headers.get("content-length")) > 8192)
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers },
      );
    const text = await request.text();
    if (text.length > 8192)
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers },
      );
    const body = new URLSearchParams(text);
    let clientId = body.get("client_id") || "",
      secret = body.get("client_secret") || "";
    const basic = request.headers.get("authorization");
    if (basic?.startsWith("Basic ")) {
      const credentials = Buffer.from(basic.slice(6), "base64").toString();
      const split = credentials.indexOf(":");
      clientId = decodeURIComponent(credentials.slice(0, split));
      secret = decodeURIComponent(credentials.slice(split + 1));
    }
    if (
      !equalSecret(clientId, config.clientId) ||
      !equalSecret(secret, config.clientSecret)
    )
      return Response.json(
        { error: "invalid_client" },
        { status: 401, headers },
      );
    const code = body.get("code") || "",
      verifier = body.get("code_verifier") || "";
    if (
      body.get("grant_type") !== "authorization_code" ||
      body.get("redirect_uri") !== config.redirectUri ||
      !/^[A-Za-z0-9_-]{43}$/.test(code) ||
      !validVerifier(verifier)
    )
      return Response.json(
        { error: "invalid_grant" },
        { status: 400, headers },
      );
    const { data, error } = await anonymousClient().rpc(
      "redeem_canva_authorization_code",
      { p_code_hash: digest(code), p_code_challenge: digest(verifier) },
    );
    if (error || typeof data !== "string")
      return Response.json(
        { error: "invalid_grant" },
        { status: 400, headers },
      );
    const grant = openGrant(data, config.encryptionKey);
    return Response.json(
      {
        access_token: data,
        token_type: "Bearer",
        expires_in: Math.floor((grant.expiresAt - Date.now()) / 1000),
        scope: "gatherings:read invitation:write",
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers },
    );
  }
}
