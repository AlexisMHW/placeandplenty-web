import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const CANVA_SCOPES = "gatherings:read invitation:write";
export const GRANT_SECONDS = 600;
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
export function validVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}
export function equalSecret(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export interface CanvaGrant {
  userId: string;
  accessToken: string;
  expiresAt: number;
}
function key(secret: string): Buffer {
  const result = Buffer.from(secret, "base64");
  if (result.length !== 32)
    throw new Error("Canva encryption key must be 32 random bytes in base64");
  return result;
}
export function sealGrant(grant: CanvaGrant, secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  cipher.setAAD(Buffer.from("place-and-plenty:canva:v1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(grant)),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openGrant(
  token: string,
  secret: string,
  now = Date.now(),
): CanvaGrant {
  if (token.length > 16000) throw new Error("Invalid grant");
  const bytes = Buffer.from(token, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from("place-and-plenty:canva:v1"));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const grant = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
  if (
    typeof grant.userId !== "string" ||
    typeof grant.accessToken !== "string" ||
    !Number.isFinite(grant.expiresAt) ||
    grant.expiresAt <= now ||
    grant.expiresAt > now + GRANT_SECONDS * 1000 + 5000
  )
    throw new Error("Expired or invalid grant");
  return grant;
}
export function validateOAuthRequest(
  params: URLSearchParams,
  config: { clientId: string; redirectUri: string },
) {
  if (
    params.get("client_id") !== config.clientId ||
    params.get("redirect_uri") !== config.redirectUri ||
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256"
  )
    throw new Error("Invalid OAuth request");
  const challenge = params.get("code_challenge") || "",
    state = params.get("state") || "";
  const scopes = (params.get("scope") || "").split(" ").filter(Boolean).sort();
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
    !state ||
    state.length > 2048 ||
    scopes.join(" ") !== CANVA_SCOPES.split(" ").sort().join(" ")
  )
    throw new Error("Invalid OAuth request");
  return { challenge, state, redirectUri: config.redirectUri };
}

/** Public OAuth clients require PKCE at authorization AND redemption. The public
 * client id identifies the sole registered client; it is never a bearer secret. */
export function validOAuthClient(
  clientId: string,
  suppliedSecret: string,
  config: {
    clientId: string;
    clientAuth: string;
    clientSecret?: string;
  },
): boolean {
  if (!equalSecret(clientId, config.clientId)) return false;
  if (config.clientAuth === "public") return suppliedSecret === "";
  return (
    config.clientAuth === "secret" &&
    Boolean(config.clientSecret) &&
    equalSecret(suppliedSecret, config.clientSecret!)
  );
}
