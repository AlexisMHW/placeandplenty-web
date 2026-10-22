import type { ContentPublisherIntent } from "@canva/intents/content";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { PublisherChoices } from "../../PublisherChoices";
import { getAuthDestinationForSelection } from "../../host_journeys";

/**
 * Preview-only Canva acquisition UI. The Content Publisher intentionally
 * fails closed until a verified return-state exchange and durable media
 * transfer are available. No success response is returned for artwork.
 */
let viewRoot: Root | undefined;
function renderView(node: React.ReactNode): void {
  const element = document.getElementById("root");
  if (!element) throw new Error("Canva app root element is missing");
  if (!viewRoot) viewRoot = createRoot(element);
  viewRoot.render(node);
}

const contentPublisher: ContentPublisherIntent = {
  getPublishConfiguration: async () => ({
    status: "completed",
    outputTypes: [{
      id: "invitation",
      displayName: "Digital invitation",
      mediaSlots: [{
        id: "artwork",
        displayName: "Invitation artwork",
        fileCount: { exact: 1 },
        accepts: { image: { format: "png" } },
      }],
    }],
  }),
  renderSettingsUi: () => {
    renderView(
      React.createElement(PublisherChoices, {
        onContinue: () => {
          // The authenticated one-time handoff is not implemented.
          // Never treat opening the website as a completed Canva connection.
          renderView(React.createElement("main", null,
            React.createElement("h1", null, "Connect to Place & Plenty"),
            React.createElement("p", null,
              "Sign in to Place & Plenty in your browser. Canva publishing is not yet available."),
            React.createElement("a", {
              href: "https://placeandplenty.com/login?next=%2Fhost",
              target: "_blank",
              rel: "noopener noreferrer",
            }, "Open Place & Plenty"),
          ));
        },
      }),
    );
  },
  renderPreviewUi: () => {
    renderView(React.createElement("main", null,
      React.createElement("h1", null, "Invitation preview"),
      React.createElement("p", null,
        "Publishing is disabled until the gathering is authorized and the artwork can be saved."),
    ));
  },
  publishContent: async () => ({
    status: "app_error",
    message: "Publishing is unavailable until Place & Plenty account authorization is configured.",
  }),
};

export default contentPublisher;
