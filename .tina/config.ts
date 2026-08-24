import { defineConfig } from "tinacms";

// Founder-facing content schema for The Coordinated Host.
// Every field here becomes a form field in the visual editor at /admin —
// no code changes needed to publish or edit an article.

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

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
      mediaRoot: "images/coordinated-host",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
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
          // --- Core ---
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
            ui: { defaultItemValue: "The Coordinated Host by Place & Plenty" },
          },
          { type: "datetime", name: "publishDate", label: "Publish date" },
          { type: "datetime", name: "updatedDate", label: "Updated date" },
          {
            type: "image",
            name: "featuredImage",
            label: "Featured image",
          },
          {
            type: "string",
            name: "featuredImageAlt",
            label: "Featured image alt text",
          },

          // --- Classification ---
          {
            type: "string",
            name: "category",
            label: "Editorial category",
            options: [
              "Beforehand",
              "At My Table",
              "Around the House",
              "People Are Coming",
              "HostReady",
              "Plan B",
            ],
          },
          {
            type: "string",
            name: "franchise",
            label: "Signature franchise (optional)",
            options: [
              "None",
              "How Much?",
              "Do I Actually Need...?",
              "Nobody Remembers...",
              "The HostReady Hour",
              "The Put-Together Get-Together",
            ],
          },
          { type: "string", name: "occasion", label: "Occasion / season" },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
          },
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

          // --- SEO ---
          { type: "string", name: "seoTitle", label: "SEO title" },
          {
            type: "string",
            name: "metaDescription",
            label: "Meta description",
            ui: { component: "textarea" },
          },
          { type: "string", name: "canonicalUrl", label: "Canonical URL (optional)" },
          {
            type: "string",
            name: "socialDescription",
            label: "Social description",
            ui: { component: "textarea" },
          },
          { type: "boolean", name: "noindex", label: "Hide from search engines" },

          // --- Distribution ---
          { type: "image", name: "pinterestImage", label: "Pinterest image" },
          { type: "string", name: "pinterestHeadline", label: "Pinterest headline" },
          {
            type: "image",
            name: "socialShareImage",
            label: "Social share image (optional override)",
          },

          // --- Product ---
          {
            type: "string",
            name: "connectedFeature",
            label: "Connected Place & Plenty feature",
          },
          {
            type: "string",
            name: "productCta",
            label: "Product CTA text",
          },
          {
            type: "string",
            name: "relatedProductMessage",
            label: "Related product message",
            ui: { component: "textarea" },
          },

          // --- Discovery ---
          {
            type: "reference",
            name: "relatedArticles",
            label: "Related articles",
            collections: ["post"],
            list: true,
          },
          { type: "boolean", name: "featured", label: "Featured article" },
          { type: "string", name: "contentHub", label: "Content hub (optional)" },

          // --- The Short Answer (optional structured block) ---
          {
            type: "string",
            name: "shortAnswer",
            label: "The Short Answer (for search-driven articles)",
            ui: { component: "textarea" },
          },

          // --- Body ---
          {
            type: "rich-text",
            name: "body",
            label: "Article body",
            isBody: true,
          },
        ],
      },
    ],
  },
});
