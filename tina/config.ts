import { defineConfig } from "tinacms";

// Founder-facing content schema.
//
// GOVERNING RULE (directive §13, §24): the homepage's structure and
// design live in code. Tina owns the words, the images and which
// published pieces are featured — nothing else. Seasonal swaps change
// content, never layout. There is deliberately no page builder: more
// ways to rearrange the homepage is more ways for a routine seasonal
// edit to take it down.
//
// KNOWN TRAP — `list: true` ON A REFERENCE FIELD.
//
// Commit be7243d recorded a Vercel build failure as "self-referencing"
// and fixed it by downgrading a reference to a list of slug strings.
// That diagnosis was wrong, and the wrong lesson would have cost real
// references everywhere. Tested against @tinacms/cli 1.12.6:
//
//   no reference                              PASS
//   single reference, another collection      PASS
//   single reference, SAME collection         PASS   <- not the problem
//   reference with list: true                 FAIL   <- the actual cause
//   object list containing one reference      PASS
//   object list containing a SELF reference   PASS
//
// A list reference generates a "...Connection" type that the document
// fragment cannot be spread into, and codegen dies. Wrapping one
// reference in an object list sidesteps it completely and keeps a real
// document picker in the editor — no slugs typed by hand, no content
// duplicated, nothing to drift out of sync.
//
// So: every relationship below is a real reference, and none uses
// `list: true` directly. Do not "simplify" them back.
//
// SECOND TRAP — Tina Cloud indexes the schema from GitHub. A schema
// change fails `tinacms build` locally with "The local GraphQL schema
// doesn't match the remote" until it is pushed. Use
// `--skip-cloud-checks` to verify a change before pushing it.

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

/** Shared SEO block. Same shape on every publishable collection. */
const seoFields = [
  { type: "string" as const, name: "seoTitle", label: "SEO title" },
  {
    type: "string" as const,
    name: "metaDescription",
    label: "Meta description",
    ui: { component: "textarea" as const },
  },
  {
    type: "string" as const,
    name: "socialDescription",
    label: "Social description",
    ui: { component: "textarea" as const },
  },
  {
    type: "string" as const,
    name: "canonicalUrl",
    label: "Canonical URL (only if this was published somewhere else first)",
  },
  {
    type: "boolean" as const,
    name: "noindex",
    label: "Hide from search engines",
  },
];

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "images/content",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      /* ============================================================ */
      /* HOMEPAGE — one document, fixed sections, editable content    */
      /* ============================================================ */
      {
        name: "homepage",
        label: "Homepage (seasonal)",
        path: "content/homepage",
        format: "json",
        ui: {
          // Exactly one homepage. Creating or deleting one would leave
          // the site with none, or with an ambiguous winner.
          allowedActions: { create: false, delete: false },
          router: () => "/",
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Internal name (not shown on the site)",
            isTitle: true,
            required: true,
          },

          {
            type: "string",
            name: "reasonLine",
            label:
              "Why people are hosting right now — e.g. Football is on. Birthdays are happening. The weather is finally tolerable. People are coming over.",
            ui: { component: "textarea" },
          },

          { type: "string", name: "heroHeadline", label: "Hero headline" },
          { type: "string", name: "heroSubhead", label: "Hero subhead" },
          {
            type: "string",
            name: "heroBody",
            label: "Hero paragraph",
            ui: { component: "textarea" },
          },
          { type: "image", name: "heroImage", label: "Hero image" },
          {
            type: "string",
            name: "heroImageAlt",
            label: "Hero image — describe it for screen readers",
          },
          {
            type: "string",
            name: "ctaLabelOverride",
            label:
              "Button text override (leave blank to use the current launch-phase default)",
          },

          // --- Featured, by reference ---------------------------------
          // No titles or images are copied here. A card renders from the
          // Gathering Idea it points at, so the two cannot disagree.
          // Flat rather than nested under a "featured" object: one less
          // level for a routine seasonal edit to get lost in.
          {
            type: "object",
            name: "seasonalCards",
            label: "Seasonal gathering cards (2-6, in order)",
            list: true,
            fields: [
              {
                type: "reference",
                name: "idea",
                label: "Gathering Idea",
                collections: ["gatheringIdea"],
              },
            ],
          },
          {
            type: "object",
            name: "featuredGatheringIdeas",
            label: "Featured Gathering Ideas",
            list: true,
            fields: [
              {
                type: "reference",
                name: "idea",
                label: "Gathering Idea",
                collections: ["gatheringIdea"],
              },
            ],
          },
          {
            type: "object",
            name: "featuredArticles",
            label: "Featured Coordinated Host pieces",
            list: true,
            fields: [
              {
                type: "reference",
                name: "article",
                label: "Article",
                collections: ["post"],
              },
            ],
          },
          {
            type: "object",
            name: "featuredCommunityStories",
            label: "Featured Show Us How You Gather entries",
            list: true,
            fields: [
              {
                type: "reference",
                name: "story",
                label: "Story",
                collections: ["communityStory"],
              },
            ],
          },
        ],
      },

      /* ============================================================ */
      /* GATHERING IDEAS                                              */
      /* ============================================================ */
      {
        name: "gatheringIdea",
        label: "Gathering Ideas",
        path: "content/gathering-ideas",
        format: "mdx",
        ui: {
          router: ({ document }) =>
            `/gathering-ideas/${document._sys.filename}`,
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "deck",
            label: "Deck (one line under the headline)",
          },
          {
            type: "string",
            name: "status",
            label: "Status",
            options: ["draft", "published"],
            required: true,
          },
          { type: "datetime", name: "publishDate", label: "Publish date" },
          { type: "image", name: "heroImage", label: "Hero image" },
          {
            type: "string",
            name: "heroImageAlt",
            label: "Hero image — describe it for screen readers",
          },

          // Card presentation lives here, not on the homepage, so a card
          // and the page it opens are edited in one place.
          {
            type: "string",
            name: "cardHeadline",
            label: "Homepage card headline (optional — defaults to the title)",
          },
          {
            type: "image",
            name: "cardImage",
            label: "Homepage card image (optional — defaults to the hero)",
          },

          {
            type: "string",
            name: "season",
            label: "Season",
            options: ["Any", "Fall", "Winter", "Spring", "Summer"],
          },
          { type: "string", name: "occasion", label: "Occasion" },
          { type: "string", name: "tags", label: "Tags", list: true },
          {
            type: "string",
            name: "contentType",
            label: "Content type",
            options: ["evergreen", "seasonal"],
          },

          ...seoFields,

          {
            type: "object",
            name: "relatedArticles",
            label: "Related Coordinated Host pieces",
            list: true,
            fields: [
              {
                type: "reference",
                name: "article",
                label: "Article",
                collections: ["post"],
              },
            ],
          },
          {
            type: "object",
            name: "relatedIdeas",
            label: "Related Gathering Ideas",
            list: true,
            fields: [
              {
                type: "reference",
                name: "idea",
                label: "Gathering Idea",
                collections: ["gatheringIdea"],
              },
            ],
          },

          {
            type: "string",
            name: "connectedFeature",
            label: "Connected Place & Plenty feature",
          },
          {
            type: "string",
            name: "relatedProductMessage",
            label: "Plan it in P&P — closing message",
            ui: { component: "textarea" },
          },

          { type: "rich-text", name: "body", label: "Body", isBody: true },
        ],
      },

      /* ============================================================ */
      /* THE COORDINATED HOST                                         */
      /* ============================================================ */
      {
        name: "post",
        label: "The Coordinated Host — Articles",
        path: "content/coordinated-host",
        format: "mdx",
        ui: {
          router: ({ document }) =>
            `/coordinated-host/${document._sys.filename}`,
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "deck",
            label: "Deck (short human explanation under the headline)",
          },
          {
            type: "string",
            name: "status",
            label: "Status",
            options: ["draft", "published"],
            required: true,
          },
          {
            type: "string",
            name: "byline",
            label: "Byline",
            ui: { defaultValue: "The Coordinated Host by Place & Plenty" },
          },
          { type: "datetime", name: "publishDate", label: "Publish date" },
          { type: "datetime", name: "updatedDate", label: "Updated date" },
          { type: "image", name: "featuredImage", label: "Featured image" },
          {
            type: "string",
            name: "featuredImageAlt",
            label: "Featured image — describe it for screen readers",
          },

          // TWO AXES, deliberately not collapsed.
          //
          //   category  — the broad editorial bucket a piece sits in
          //   franchise — the recurring named series it belongs to
          //
          // A piece can be "Beforehand" AND "The Host Note". Folding
          // them together would force a choice between the shelf and the
          // series. Revisit only if real content proves the distinction
          // does not earn its keep.
          {
            type: "string",
            name: "category",
            label: "Editorial category (broad topic)",
            options: [
              "Beforehand",
              "At My Table",
              "Around the House",
              "People Are Coming",
              "HostReady",
              "Plan B",
            ],
          },
          // The recurring named series. Directive §15's approved concepts
          // first, then the earlier named series from the editorial
          // bible — those are recurring series too, and dropping them
          // was never asked for. Prune once real content shows which
          // ones actually run.
          {
            type: "string",
            name: "franchise",
            label: "Recurring series (optional)",
            options: [
              "None",
              "Host Math",
              "Space & Flow",
              "Menu & Food",
              "Table & Style",
              "Before They Arrive",
              "The Real-Life Version",
              "The Host Note",
              "Use What You Have",
              "Space Check",
              "Plan It in P&P",
              "How Much?",
              "Do I Actually Need...?",
              "Nobody Remembers...",
              "The HostReady Hour",
              "The Put-Together Get-Together",
            ],
          },
          { type: "string", name: "occasion", label: "Occasion / season" },
          { type: "string", name: "tags", label: "Tags", list: true },
          {
            type: "string",
            name: "contentType",
            label: "Content type",
            options: ["evergreen", "seasonal"],
          },
          {
            type: "string",
            name: "articleWeight",
            label: "Article weight",
            options: ["cornerstone", "standard", "note"],
          },

          ...seoFields,

          { type: "image", name: "pinterestImage", label: "Pinterest image" },
          {
            type: "string",
            name: "pinterestHeadline",
            label: "Pinterest headline",
          },
          {
            type: "image",
            name: "socialShareImage",
            label: "Social share image (optional override)",
          },

          {
            type: "string",
            name: "connectedFeature",
            label: "Connected Place & Plenty feature",
          },
          { type: "string", name: "productCta", label: "Product CTA text" },
          {
            type: "string",
            name: "relatedProductMessage",
            label: "Related product message",
            ui: { component: "textarea" },
          },

          {
            type: "object",
            name: "relatedGatheringIdeas",
            label: "Related Gathering Ideas",
            list: true,
            fields: [
              {
                type: "reference",
                name: "idea",
                label: "Gathering Idea",
                collections: ["gatheringIdea"],
              },
            ],
          },
          // The exact field that broke the build in be7243d — a real
          // reference again, in the shape that actually works.
          {
            type: "object",
            name: "relatedArticles",
            label: "Related articles",
            list: true,
            fields: [
              {
                type: "reference",
                name: "article",
                label: "Article",
                collections: ["post"],
              },
            ],
          },

          { type: "boolean", name: "featured", label: "Featured article" },
          {
            type: "string",
            name: "contentHub",
            label: "Content hub (optional)",
          },
          {
            type: "string",
            name: "shortAnswer",
            label: "The Short Answer (for search-driven articles)",
            ui: { component: "textarea" },
          },

          {
            type: "rich-text",
            name: "body",
            label: "Article body",
            isBody: true,
          },
        ],
      },

      /* ============================================================ */
      /* SHOW US HOW YOU GATHER                                       */
      /* ============================================================ */
      {
        name: "communityStory",
        label: "Show Us How You Gather",
        path: "content/show-us-how-you-gather",
        format: "mdx",
        ui: {
          router: ({ document }) =>
            `/show-us-how-you-gather/${document._sys.filename}`,
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "status",
            label: "Status",
            options: ["draft", "published"],
            required: true,
          },

          // CONSENT GATE. Directive §16: submission is not blanket
          // marketing consent, and permission has to cover identifiable
          // adults, children, private homes, photos and quotes. This is
          // the founder confirming that before it goes public. The site
          // refuses to render a story without it, published or not.
          {
            type: "boolean",
            name: "consentConfirmed",
            label:
              "Permission confirmed to feature this — including any identifiable people, children, and the home shown",
            required: true,
          },

          {
            type: "string",
            name: "contributorName",
            label: "How to credit them (first name, or leave blank)",
          },
          {
            type: "string",
            name: "gatheringType",
            label: "What kind of gathering",
          },
          { type: "datetime", name: "publishDate", label: "Publish date" },

          { type: "image", name: "heroImage", label: "Main photo" },
          {
            type: "string",
            name: "heroImageAlt",
            label: "Main photo — describe it for screen readers",
          },

          {
            type: "string",
            name: "whatWorked",
            label: "What worked",
            ui: { component: "textarea" },
          },
          {
            type: "string",
            name: "wouldDoDifferently",
            label: "What they would do differently",
            ui: { component: "textarea" },
          },
          {
            type: "string",
            name: "helpedWith",
            label: "What Place & Plenty helped with (optional)",
            ui: { component: "textarea" },
          },

          ...seoFields,

          { type: "rich-text", name: "body", label: "Their story", isBody: true },
        ],
      },
    ],
  },
});
