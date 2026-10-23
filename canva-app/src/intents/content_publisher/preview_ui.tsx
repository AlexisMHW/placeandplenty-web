import { useIntl } from "react-intl";
import { messages } from "../../messages";
import { Rows, Text } from "@canva/app-ui-kit";
import type { RenderPreviewUiRequest } from "@canva/intents/content";
import { useEffect, useState } from "react";
import { parseInvitationPublishRef } from "./publish_settings";
export function PreviewUi({
  invocationContext,
  registerOnPreviewChange,
}: RenderPreviewUiRequest) {
  const intl = useIntl();
  const [data, setData] =
    useState<
      Pick<
        RenderPreviewUiRequest["invocationContext"],
        "previewMedia" | "publishRef" | "outputType"
      >
    >(invocationContext);
  useEffect(
    () => registerOnPreviewChange((next) => setData(next)),
    [registerOnPreviewChange],
  );
  const settings = parseInvitationPublishRef(data?.publishRef);
  const media = data?.previewMedia?.find(
    (item) => item.mediaSlotId === "artwork",
  );
  const preview = media?.previews[0];
  return (
    <Rows spacing="2u">
      <Text>{intl.formatMessage(messages.previewTitle)}</Text>
      {settings ? (
        <Text>{intl.formatMessage(messages.previewReplace)}</Text>
      ) : (
        <Text>{intl.formatMessage(messages.previewSelect)}</Text>
      )}
      {preview?.status === "error" ? (
        <div role="alert">
          <Text>{intl.formatMessage(messages.previewFailed)}</Text>
        </div>
      ) : preview?.kind === "image" && preview.status === "ready" ? (
        <img
          src={preview.url}
          alt={intl.formatMessage(messages.previewAlt)}
          style={{ maxWidth: "100%", maxHeight: 600, objectFit: "contain" }}
        />
      ) : (
        <Text>{intl.formatMessage(messages.previewPreparing)}</Text>
      )}
    </Rows>
  );
}
