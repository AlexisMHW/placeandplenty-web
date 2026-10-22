import type { ContentPublisherIntent } from "@canva/intents/content";

/**
 * SDK scaffold only. This is deliberately NOT a deployable publisher:
 * publishing must remain disabled until the signed-in host and authorized
 * gathering are verified and real media transfer is implemented.
 */
const contentPublisher: ContentPublisherIntent = {
  getPublishConfiguration: async () => ({
    status: "completed",
    outputTypes: [
      {
        id: "invitation",
        displayName: "Digital invitation",
        mediaSlots: [
          {
            id: "artwork",
            displayName: "Invitation artwork",
            fileCount: { exact: 1 },
            accepts: { image: { format: "png" } },
          },
        ],
      },
    ],
  }),
  renderSettingsUi: () => {
    throw new Error("Place & Plenty authentication and gathering selection are not implemented.");
  },
  renderPreviewUi: () => {
    throw new Error("Place & Plenty invitation preview is not implemented.");
  },
  publishContent: async () => ({
    status: "app_error",
    message: "Publishing is unavailable until Place & Plenty account authorization is configured.",
  }),
};

export default contentPublisher;
