# Holiday editorial release — October 7, 2026

Eight articles in `content/coordinated-host` use `contentHub: holiday-less-spending` and link through the journal's `#holiday-series` section. Each includes practical steps or a worksheet, a short answer, a product walkthrough, metadata, tags, self-canonical URL, alt text and two related article references. Social publication remains unscheduled.

## Image provenance

- All eight articles now have unique story-specific generated editorial images under `public/images/holiday/`; each card, article and social image uses the same matching asset.
- New scenes: holiday budgeting, Friendsgiving contributions, soup-and-bread supper, repeating traditions, take-home desserts, and shared seasonal cleanup.
- Existing series-specific décor-swap and gifts-of-help images retained.
- Author portrait: existing approved `FOUNDER_PHOTO`; no facial edits.
- The extra featured table-setting block was removed from the journal page.

Generated scenes are fictional, not photographs of Alexis, her family or actual friends. The new images were created with the built-in image-generation tool and encoded as WebP without altering their composition. No verified personal family-and-friends photo set was located for this release; do not relabel these illustrations as actual founder gatherings. Future founder-selected photographs can replace each featured image in Tina.

## CTAs and release checks

The article CTA goes to `/signup?next=%2Fhost%2Fcreate`; returning signed-in users follow existing redirect handling. The download CTA uses `hasAnyStoreLink()` and `/get`, so it appears only after real app-store destinations are configured. No placeholder store URL is added.

The established sitemap reads published Tina posts automatically. The content must be committed, indexed by Tina Cloud and successfully deployed before declaring the URLs live. Preview builds and production can differ if their Tina branch indexes differ.

The food-favor article is a holiday packing/counting companion, links to the existing evergreen founder article and receives a reciprocal link. Food safety guidance cites FoodSafety.gov, checked October 7, 2026.
