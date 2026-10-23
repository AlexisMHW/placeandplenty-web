import { auth } from "@canva/user";
declare const BACKEND_URL: string;
export const backend = BACKEND_URL;
export const scope = new Set(["gatherings:read", "invitation:write"]);
export const oauth = auth.initOauth({
  provider: "placeandplenty",
  type: "single_account",
});
export async function api(path: string, init: RequestInit = {}) {
  const access = await oauth.getAccessToken({ scope });
  if (!access) throw new Error("Connect your Place & Plenty account");
  const response = await fetch(`${backend}/api/canva/${path}`, {
    ...init,
    credentials: "omit",
    headers: { ...init.headers, Authorization: `Bearer ${access.token}` },
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Reconnect your Place & Plenty account"
        : "The request could not be completed. Check your gathering and try again.",
    );
  return response.json();
}
