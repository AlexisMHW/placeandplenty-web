import { initIntl } from "@canva/app-i18n-kit";
import { messages } from "./messages";
import { PublisherError } from "./publisher_error";
import { auth } from "@canva/user";
declare const BACKEND_URL: string;
export const backend = BACKEND_URL;
export const scope = new Set(["gatherings:read", "invitation:write"]);
export const oauth = auth.initOauth({
  provider: "placeandplenty",
  type: "single_account",
});
const intl = initIntl();
export async function api(path: string, init: RequestInit = {}) {
  let access;
  try {
    access = await oauth.getAccessToken({ scope });
  } catch {
    throw new PublisherError(intl.formatMessage(messages.reconnectRequired));
  }
  if (!access)
    throw new PublisherError(intl.formatMessage(messages.connectRequired));
  let response: Response;
  try {
    response = await fetch(`${backend}/api/canva/${path}`, {
      ...init,
      credentials: "omit",
      signal: init.signal ?? AbortSignal.timeout(30000),
      headers: { ...init.headers, Authorization: `Bearer ${access.token}` },
    });
  } catch {
    // A lost response may follow a successful save. Never automatically retry.
    throw new PublisherError(
      intl.formatMessage(messages.connectionInterrupted),
    );
  }
  if (!response.ok)
    throw new PublisherError(
      response.status === 429
        ? intl.formatMessage(messages.rateLimited)
        : response.status === 409
          ? intl.formatMessage(messages.publishPending)
          : response.status === 401
            ? intl.formatMessage(messages.reconnectRequired)
            : intl.formatMessage(messages.requestFailed),
    );
  try {
    return await response.json();
  } catch {
    throw new PublisherError(intl.formatMessage(messages.requestFailed));
  }
}
