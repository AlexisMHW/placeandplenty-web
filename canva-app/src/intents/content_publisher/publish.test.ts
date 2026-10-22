import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@canva/app-i18n-kit", () => ({
  initIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) =>
      defaultMessage,
  }),
  AppI18nProvider: () => null,
}));
vi.mock("@canva/app-ui-kit", () => ({ AppUiProvider: () => null }));
vi.mock("@canva/app-ui-kit/styles.css", () => ({}));
vi.mock("./settings_ui", () => ({ SettingsUi: () => null }));
vi.mock("./preview_ui", () => ({ PreviewUi: () => null }));
vi.mock("../../api", () => ({
  api: vi.fn(),
  backend: "https://preview.example",
}));
import { api } from "../../api";
import { publishContent } from "./index";
import type { PublishContentRequest } from "@canva/intents/content";
const id = "f2f91df4-8c45-4e7e-9a16-313314324889";
function request(optIn = true): PublishContentRequest {
  return {
    publishRef: JSON.stringify({
      gatheringId: id,
      duration: "single_day",
      invitationOptIn: optIn,
    }),
    outputType: { id: "invitation" },
    outputMedia: [
      {
        mediaSlotId: "artwork",
        files: [{ format: "png", url: "https://export.example/artwork.png" }],
      },
    ],
  } as PublishContentRequest;
}
describe("Content Publisher", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(
          async () => new Response(new Uint8Array([1, 2, 3])),
        ),
    );
  });
  it("opt-out never downloads or uploads media", async () => {
    expect((await publishContent(request(false))).status).toBe("app_error");
    expect(fetch).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });
  it("refuses extra files and non-HTTPS exports", async () => {
    const multiple = request();
    multiple.outputMedia.push(multiple.outputMedia[0]!);
    expect((await publishContent(multiple)).status).toBe("app_error");
    const unsafe = request();
    unsafe.outputMedia[0]!.files[0]!.url = "http://localhost/private";
    expect((await publishContent(unsafe)).status).toBe("app_error");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("backend failure and unconfirmed persistence never report completed", async () => {
    vi.mocked(api)
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValueOnce({ status: "completed", gatheringId: "another" });
    expect((await publishContent(request())).status).toBe("app_error");
    expect((await publishContent(request())).status).toBe("app_error");
  });
  it("confirmed persistence returns the authorized gathering link", async () => {
    vi.mocked(api).mockResolvedValue({ status: "completed", gatheringId: id });
    expect(await publishContent(request())).toEqual({
      status: "completed",
      externalId: id,
      externalUrl: `https://preview.example/host/g/${id}`,
    });
    expect(api).toHaveBeenCalledWith(
      `publish?gatheringId=${id}`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "image/png", "X-Invitation-Opt-In": "true" },
      }),
    );
  });
  it("oversized exports are rejected before backend upload", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array(10 * 1024 * 1024 + 1)),
    );
    expect((await publishContent(request())).status).toBe("app_error");
    expect(api).not.toHaveBeenCalled();
  });
});
