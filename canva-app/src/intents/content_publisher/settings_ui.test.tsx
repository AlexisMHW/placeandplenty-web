import { PublisherError } from "../../publisher_error";
import { PreviewUi } from "./preview_ui";
import type { RenderPreviewUiRequest } from "@canva/intents/content";
import { IntlProvider } from "react-intl";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import type { RenderSettingsUiRequest } from "@canva/intents/content";
vi.mock("@canva/app-ui-kit", () => ({
  Rows: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  Button: ({
    children,
    variant: _variant,
    ...props
  }: {
    children: ReactNode;
    variant: string;
  }) => <button {...props}>{children}</button>,
  FormField: ({
    label,
    control,
  }: {
    label: string;
    control: (props: object) => ReactNode;
  }) => (
    <label>
      {label}
      {control({})}
    </label>
  ),
  Select: ({
    options,
    onChange,
    value,
  }: {
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    value: string;
  }) => (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select a gathering</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Checkbox: ({
    label,
    checked,
    disabled,
    onChange,
  }: {
    label: string;
    checked: boolean;
    disabled: boolean;
    onChange: (event: unknown, checked: boolean) => void;
  }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event, event.target.checked)}
      />
      {label}
    </label>
  ),
}));
vi.mock("@canva/platform", () => ({ requestOpenExternalUrl: vi.fn() }));
vi.mock("../../api", () => ({
  api: vi.fn(),
  backend: "https://qa.example",
  scope: new Set(),
  oauth: { getAccessToken: vi.fn(), requestAuthorization: vi.fn() },
}));
import { api, oauth } from "../../api";
import { requestOpenExternalUrl } from "@canva/platform";
import { SettingsUi } from "./settings_ui";
const gathering = {
  id: "f2f91df4-8c45-4e7e-9a16-313314324889",
  name: "QA dinner",
  duration: "single_day",
};
function mount() {
  const update = vi.fn();
  render(
    <IntlProvider locale="en" messages={{}}>
      <SettingsUi
        {...({
          updatePublishSettings: update,
        } as unknown as RenderSettingsUiRequest)}
      />
    </IntlProvider>,
  );
  return update;
}
async function chooseAndOptIn() {
  fireEvent.change(await screen.findByRole("combobox"), {
    target: { value: gathering.id },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}
describe("Publisher account and invitation consent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(oauth.getAccessToken).mockResolvedValue(null);
    vi.mocked(api).mockResolvedValue({ gatherings: [gathering] });
  });
  afterEach(cleanup);
  it("starts disconnected with no usable publish reference or invitation opt-in", async () => {
    const update = mount();
    await waitFor(() => expect(oauth.getAccessToken).toHaveBeenCalled());
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(update).toHaveBeenLastCalledWith({
      publishRef: "",
      validityState: "invalid_authentication_required",
    });
    expect(api).not.toHaveBeenCalled();
  });
  it("requires fresh opt-in when the selected gathering changes", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test",
    } as never);
    const update = mount();
    await chooseAndOptIn();
    await waitFor(() =>
      expect(update.mock.lastCall?.[0].validityState).toBe("valid"),
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(update).toHaveBeenLastCalledWith({
      publishRef: "",
      validityState: "invalid_missing_required_fields",
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
  });
  it("expired authentication on refresh clears selection and blocks publishing", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test",
    } as never);
    const update = mount();
    await chooseAndOptIn();
    vi.mocked(api).mockRejectedValueOnce(
      new PublisherError("Reconnect your Place & Plenty account"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh gatherings" }));
    await screen.findByText("Reconnect your Place & Plenty account");
    expect(screen.queryByRole("combobox")).toBe(null);
    expect(update).toHaveBeenLastCalledWith({
      publishRef: "",
      validityState: "invalid_authentication_required",
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
  });
  it("canceling reconnection cannot retain the previous account's selection", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test",
    } as never);
    vi.mocked(oauth.requestAuthorization).mockResolvedValue({
      status: "cancelled",
    } as never);
    const update = mount();
    await chooseAndOptIn();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect account" }));
    await screen.findByText("Connection canceled. You can try again.");
    expect(update).toHaveBeenLastCalledWith({
      publishRef: "",
      validityState: "invalid_authentication_required",
    });
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
  });
  it("reconnected accounts must select again and explicitly opt in", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test",
      scope: new Set(),
    });
    vi.mocked(oauth.requestAuthorization).mockResolvedValue({
      status: "completed",
      scope: new Set(),
    });
    const other = {
      ...gathering,
      id: "36dd776a-6517-43d9-99c9-e45af948f7d0",
      name: "Other account dinner",
    };
    vi.mocked(api)
      .mockResolvedValueOnce({ gatherings: [gathering] })
      .mockResolvedValueOnce({ gatherings: [other] });
    const update = mount();
    await chooseAndOptIn();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect account" }));
    await screen.findByRole("option", { name: "Other account dinner" });
    expect(screen.queryByRole("option", { name: gathering.name })).toBe(null);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false,
    );
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith({
        publishRef: "",
        validityState: "invalid_missing_required_fields",
      }),
    );
  });
  it("Not now clears artwork consent and opens planning without publishing", async () => {
    vi.mocked(oauth.getAccessToken).mockResolvedValue({
      token: "test",
    } as never);
    const update = mount();
    await chooseAndOptIn();
    fireEvent.click(
      screen.getByRole("button", { name: "Not now — continue planning" }),
    );
    expect(requestOpenExternalUrl).toHaveBeenCalledWith({
      url: "https://qa.example/host",
    });
    expect(update).toHaveBeenLastCalledWith({
      publishRef: "",
      validityState: "invalid_missing_required_fields",
    });
    expect(
      vi.mocked(api).mock.calls.every(([path]) => path === "gatherings"),
    ).toBe(true);
  });
});

describe("Localized preview rendering", () => {
  afterEach(cleanup);
  it("shows a recoverable error instead of an endless preparing state", () => {
    render(
      <IntlProvider locale="en" messages={{}}>
        <PreviewUi
          {...({
            invocationContext: {
              previewMedia: [
                {
                  mediaSlotId: "artwork",
                  previews: [{ kind: "image", status: "error" }],
                },
              ],
            },
            registerOnPreviewChange: vi.fn(() => () => {}),
          } as unknown as RenderPreviewUiRequest)}
        />
      </IntlProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Preview unavailable",
    );
    expect(screen.queryByText("Preparing invitation preview…")).toBe(null);
  });
  it("uses provider translations for accessible image text", () => {
    render(
      <IntlProvider
        locale="fr"
        messages={{
          "publisher.previewAlt": "Votre invitation",
          "publisher.previewTitle": "Aperçu",
          "publisher.previewSelect": "Choisissez une rencontre.",
        }}
      >
        <PreviewUi
          {...({
            invocationContext: {
              previewMedia: [
                {
                  mediaSlotId: "artwork",
                  previews: [
                    {
                      kind: "image",
                      status: "ready",
                      url: "https://example.test/invitation.png",
                    },
                  ],
                },
              ],
            },
            registerOnPreviewChange: vi.fn(() => () => {}),
          } as unknown as RenderPreviewUiRequest)}
        />
      </IntlProvider>,
    );
    expect(
      screen.getByRole("img", { name: "Votre invitation" }).getAttribute("src"),
    ).toBe("https://example.test/invitation.png");
  });
});
