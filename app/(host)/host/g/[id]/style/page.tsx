import { getStyleBoard } from "@/lib/host-data";
import { WorkspaceHeader, EmptyState, Panel } from "@/components/host/Workspace";

// MY STYLE BOARD (§9, the look & the day).
//
// READ-ONLY, AND FOR A PRODUCT REASON RATHER THAN AN UNFINISHED ONE.
// The board's content is photographs the host uploads and an AI analysis
// of them (gathering_style_board_analysis, gathering_style_components).
// The inputs are images and the outputs are derived; there is no
// meaningful text field for a desktop to edit. Adding an image from web
// would need the storage upload path and the analysis trigger the app
// owns, which is a bigger piece than it looks and belongs with the
// feature, not beside it.
//
// What a desktop IS good for here is seeing the whole board at once —
// which is the thing a phone is worst at — so that is what this does.
//
// COMPONENTS ARE SEARCH LANGUAGE, NOT PRODUCTS. The table comment is
// explicit: "Never brands, prices, retailers or URLs — those cannot be
// known from a photo." So they are presented as things to look for, and
// nothing here implies a shop.

export const metadata = { title: "My Style Board" };

export default async function StylePage({
  params,
}: {
  params: { id: string };
}) {
  const { board, images, components } = await getStyleBoard(params.id);

  const hasAnything =
    board?.theme ||
    board?.vision_notes ||
    (board?.mood_descriptors?.length ?? 0) > 0 ||
    images.length > 0 ||
    components.length > 0;

  return (
    <div>
      <WorkspaceHeader
        title="My Style Board"
        description="The look you're going for, and what it needs."
      />

      {!hasAnything ? (
        <EmptyState
          title="No look set yet."
          body="Collect a few images in the app and Place & Plenty pulls out the pieces that make them work — colours, textures, the things worth finding."
          hint="Style boards are built in the app, where the camera is."
        />
      ) : (
        <div className="mt-8 space-y-6">
          {(board?.theme ||
            board?.vision_notes ||
            (board?.mood_descriptors?.length ?? 0) > 0) && (
            <Panel>
              {board?.theme && (
                <h3 className="font-display text-2xl text-forest">
                  {board.theme}
                </h3>
              )}
              {board?.mood_descriptors && board.mood_descriptors.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {board.mood_descriptors.map((mood) => (
                    <li
                      key={mood}
                      className="rounded-full border border-sage/40 px-3 py-1 font-body text-sm text-forest/75"
                    >
                      {mood}
                    </li>
                  ))}
                </ul>
              )}
              {board?.vision_notes && (
                <p className="mt-4 font-body text-base leading-relaxed text-forest/80">
                  {board.vision_notes}
                </p>
              )}
            </Panel>
          )}

          {components.length > 0 && (
            <Panel>
              <h3 className="font-display text-xl text-forest">
                What it&rsquo;s made of
              </h3>
              <p className="mt-1 font-body text-sm text-forest/65">
                Things to look for — in your own cupboards first.
              </p>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {components.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-card border border-sage/25 bg-offwhite p-3"
                  >
                    <p className="font-body text-base text-forest">
                      {c.component_name}
                    </p>
                    {(c.descriptor || c.component_type) && (
                      <p className="mt-0.5 font-body text-sm text-forest/60">
                        {[c.descriptor, c.component_type]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {images.length > 0 && (
            <Panel>
              <h3 className="font-display text-xl text-forest">
                {images.length} {images.length === 1 ? "image" : "images"} on
                this board
              </h3>
              {/* Storage paths, not URLs — these live in a private bucket
                  and need a signed URL to display. Signing them from web
                  is a follow-up; listing them is honest in the meantime,
                  and better than a grid of broken images. */}
              <ul className="mt-4 space-y-1.5">
                {images.map((img) => (
                  <li key={img.id} className="font-body text-sm text-forest/70">
                    {img.caption || "Untitled"}
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-body text-sm text-forest/60">
                Open the board in the app to see them.
              </p>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
