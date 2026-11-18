import { validOAuthClient } from "./canva-security.ts";
export function oauthClientAuthorized(
  headers: Headers,
  body: URLSearchParams,
  config: { clientId: string; clientAuth: string; clientSecret?: string },
) {
  if (
    body.getAll("client_id").length > 1 ||
    body.getAll("client_secret").length > 1
  )
    return false;
  let clientId = body.get("client_id") || "",
    secret = body.get("client_secret") || "";
  const basic = headers.get("authorization");
  if (basic) {
    if (!/^Basic [A-Za-z0-9+/]+={0,2}$/.test(basic)) return false;
    const credentials = Buffer.from(basic.slice(6), "base64").toString();
    const split = credentials.indexOf(":");
    if (split < 0) return false;
    try {
      const headerId = decodeURIComponent(credentials.slice(0, split));
      const headerSecret = decodeURIComponent(credentials.slice(split + 1));
      if (
        (body.has("client_id") && clientId !== headerId) ||
        (body.has("client_secret") && secret !== headerSecret)
      )
        return false;
      clientId = headerId;
      secret = headerSecret;
    } catch {
      return false;
    }
  }
  return validOAuthClient(clientId, secret, config);
}
