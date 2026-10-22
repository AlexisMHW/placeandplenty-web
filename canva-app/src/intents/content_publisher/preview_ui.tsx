import { Rows, Text } from "@canva/app-ui-kit";
import type { RenderPreviewUiRequest } from "@canva/intents/content";
import { useEffect, useState } from "react";
import { parseInvitationPublishRef } from "./publish_settings";
export function PreviewUi({
  invocationContext,
  registerOnPreviewChange,
}: RenderPreviewUiRequest) {
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
      <Text>Digital invitation preview</Text>
      {settings ? (
        <Text>
          Publishing replaces the selected gathering’s invitation artwork.
        </Text>
      ) : (
        <Text>Select a gathering and choose to use your design.</Text>
      )}
      {preview?.kind === "image" && preview.status === "ready" ? (
        <img
          src={preview.url}
          alt="Your invitation artwork"
          style={{ maxWidth: "100%", maxHeight: 600, objectFit: "contain" }}
        />
      ) : (
        <Text>Preparing invitation preview…</Text>
      )}
    </Rows>
  );
}
