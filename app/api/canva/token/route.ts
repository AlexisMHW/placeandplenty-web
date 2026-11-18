import { anonymousClient, canvaConfig } from "@/lib/canva-server";
import { CanvaBodyTooLarge, readCanvaBody } from "@/lib/canva-request";
import { digest, openGrant, validVerifier } from "@/lib/canva-security";
import { oauthClientAuthorized } from "@/lib/canva-oauth-client";
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
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      await readCanvaBody(request, 8192),
    );
    const body = new URLSearchParams(text);
    if (!oauthClientAuthorized(request.headers, body, config))
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
  } catch (error) {
    if (error instanceof CanvaBodyTooLarge || error instanceof TypeError)
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers },
      );
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers },
    );
  }
}
