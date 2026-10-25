import { messages } from "../../messages";
import { PublisherError } from "../../publisher_error";
import { AppI18nProvider, initIntl } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type {
  ContentPublisherIntent,
  GetPublishConfigurationResponse,
  PublishContentRequest,
  PublishContentResponse,
  RenderPreviewUiRequest,
  RenderSettingsUiRequest,
} from "@canva/intents/content";
import { createRoot } from "react-dom/client";
import "@canva/app-ui-kit/styles.css";
import { PreviewUi } from "./preview_ui";
import { SettingsUi } from "./settings_ui";

import { api, backend } from "../../api";
import { parseInvitationPublishRef } from "./publish_settings";

const intl = initIntl();

// Render the settings UI where users configure publishing options
function renderSettingsUi(request: RenderSettingsUiRequest) {
  const root = createRoot(document.getElementById("root") as Element);
  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <SettingsUi {...request} />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

// Render the preview UI showing how the content will appear after publishing
function renderPreviewUi(request: RenderPreviewUiRequest) {
  const root = createRoot(document.getElementById("root") as Element);
  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <PreviewUi {...request} />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

// Define the output types (publishing formats) available to users
// Canva automatically displays a dropdown selector when more than one output type is defined
async function getPublishConfiguration(): Promise<GetPublishConfigurationResponse> {
  // https://www.canva.dev/docs/apps/api/preview/intents-content-prepare-content-publisher/#implementation

  return {
    status: "completed",
    outputTypes: [
      {
        id: "invitation",
        displayName: intl.formatMessage(messages.invitation),
        mediaSlots: [
          {
            id: "artwork",
            displayName: intl.formatMessage(messages.artwork),
            fileCount: { exact: 1 },
            accepts: {
              image: {
                format: "png",
              },
            },
          },
        ],
      },
    ],
  };
}

// Handle the actual publishing when the user clicks the publish button
// The existing backend must confirm canonical persistence before success.
export async function publishContent(
  request: PublishContentRequest,
): Promise<PublishContentResponse> {
  try {
    const settings = parseInvitationPublishRef(request.publishRef);
    if (
      !settings ||
      request.outputType.id !== "invitation" ||
      request.outputMedia.length !== 1
    )
      throw new PublisherError(intl.formatMessage(messages.invalidSettings));
    const media = request.outputMedia[0];
    const file = media?.files[0];
    if (
      !media ||
      media.mediaSlotId !== "artwork" ||
      media.files.length !== 1 ||
      !file ||
      file.format !== "png"
    )
      throw new PublisherError(intl.formatMessage(messages.onePng));
    const url = new URL(file.url);
    if (url.protocol !== "https:")
      throw new PublisherError(intl.formatMessage(messages.invalidExport));
    const downloaded = await fetch(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(30000),
    });
    if (!downloaded.ok)
      throw new PublisherError(intl.formatMessage(messages.exportFailed));
    const reader = downloaded.body?.getReader();
    if (!reader)
      throw new PublisherError(intl.formatMessage(messages.emptyExport));
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 10 * 1024 * 1024) {
        await reader.cancel();
        throw new PublisherError(intl.formatMessage(messages.exportTooLarge));
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const result = await api(`publish?gatheringId=${settings.gatheringId}`, {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-Invitation-Opt-In": "true",
        "X-Publish-Request-Id": settings.requestId,
      },
      body: bytes,
    });
    if (
      result.status !== "completed" ||
      result.gatheringId !== settings.gatheringId
    )
      throw new PublisherError(intl.formatMessage(messages.saveUnconfirmed));
    return {
      status: "completed",
      externalId: settings.gatheringId,
      externalUrl: `${backend}/host/g/${settings.gatheringId}`,
    };
  } catch (error) {
    const message =
      error instanceof PublisherError
        ? error.message
        : intl.formatMessage(messages.publishFailed);
    return {
      status: "app_error",
      message,
      // Canva's default error banner hides message. Forward only our own
      // sanitized/localized text to the settings panel, never raw exceptions.
      appDefinedPayload: JSON.stringify({ message }),
    };
  }
}

const contentPublisher: ContentPublisherIntent = {
  renderSettingsUi,
  renderPreviewUi,
  getPublishConfiguration,
  publishContent,
};

export default contentPublisher;
