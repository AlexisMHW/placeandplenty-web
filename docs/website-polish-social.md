# Website artwork and social participation

This update changes website presentation only. Native code, API routes, authentication, database schemas, canonical product records, and community publication/consent logic are unchanged.

## Artwork

Five original illustrations live in `public/images/checklist-kits/`: Halloween, Friendsgiving, Thanksgiving, Game Day, and Before the Doorbell. Each is a full-frame WebP encoded from generated artwork. The accessible `ChecklistCover` component adds responsive P&P typography and the kit's actual section titles. The printable PDF contents are unchanged.

Art direction: landscape 3:2 textured gouache on warm cream, forest green, sage and muted gold; quiet left half for typeset cover and occasion-specific objects on the right. Halloween uses pumpkins and caramel apples; Friendsgiving uses mismatched potluck dishes; Thanksgiving uses turkey and pie; Game Day uses football, snacks and a remote; Before the Doorbell uses a towel, clock and last-minute hosting details. No text or logos generated into the raster.

## Social workflow

1. Visitors tag @placeandplenty with #ShowUsHowYouGather or privately message P&P on Instagram/Facebook with photos, a short video and their story.
2. Alexis reviews within the social account and asks for explicit permission covering the intended social and/or website feature and credit.
3. Selected website stories use the existing editorial community collection. Its existing published-status and consent checks remain the publication gate. The website carousel renders only those selected stories.
4. Return a story to draft to remove it from the public collection through the existing publishing workflow. Do not treat a hashtag alone as reuse permission.

An automatic external social feed, video ingestion, notification service and new moderation dashboard are not connected by this change. There are no fabricated community submissions. A social feed provider must be selected and connected before live feed synchronization can be promised.

## Email setup pending owner access

Desired addresses: alexis@placeandplenty.com, gatherings@placeandplenty.com, support@placeandplenty.com, info@placeandplenty.com, showushowyougather@placeandplenty.com. Google Workspace account setup and domain verification still need the owner. No mailbox, alias, DNS record or email provider credential is created here.

## Verification

TypeScript validation and all seven existing checklist-delivery tests pass. Scoped ESLint and deployment build are checked during release. Browser verification is reported separately; responsive CSS fixes alone do not prove a physical-device check.
