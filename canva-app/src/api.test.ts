vi.mock("@canva/app-i18n-kit", async () => {
  const { createIntl } =
    await vi.importActual<typeof import("react-intl")>("react-intl");
  return { initIntl: () => createIntl({ locale: "en", messages: {} }) };
});
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@canva/user", () => ({
  auth: { initOauth: vi.fn(() => ({ getAccessToken: vi.fn() })) },
}));
vi.stubGlobal("BACKEND_URL", "https://qa.example");
const { api, oauth, scope } = await import("./api");
describe("Publisher API connection and retry boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test-grant",
      scope,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ status: "completed" })),
    );
  });
  it("a disconnected account never reaches the backend", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue(null);
    await expect(api("gatherings")).rejects.toThrow(
      "Connect your Place & Plenty account",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the scoped grant, omits cookies and bounds the request lifetime", async () => {
    await expect(api("gatherings")).resolves.toEqual({ status: "completed" });
    expect(oauth.getAccessToken).toHaveBeenCalledWith({ scope });
    expect(fetch).toHaveBeenCalledWith(
      "https://qa.example/api/canva/gatherings",
      expect.objectContaining({
        credentials: "omit",
        signal: expect.any(AbortSignal),
        headers: { Authorization: "Bearer test-grant" },
      }),
    );
  });
  it("expired authorization requires reconnection without an implicit retry", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("private server details", { status: 401 }),
    );
    await expect(api("publish")).rejects.toThrow(
      "Reconnect your Place & Plenty account",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("a lost save response asks the host to check their gathering and does not retry", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("timeout", "TimeoutError"),
    );
    await expect(api("publish", { method: "POST" })).rejects.toThrow(
      "Check your gathering before retrying",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("SDK authentication errors do not expose private details", async () => {
    vi.mocked(oauth.getAccessToken).mockRejectedValue(
      new Error("private SDK details"),
    );
    await expect(api("gatherings")).rejects.toThrow(
      "Reconnect your Place & Plenty account",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("malformed server responses become a safe error without retrying", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not JSON"));
    await expect(api("publish")).rejects.toThrow(
      "The request could not be completed",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("server failures do not expose private response details or retry", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("private server details", { status: 500 }),
    );
    await expect(api("publish")).rejects.toThrow(
      "The request could not be completed",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
