/**
 * Global settings collection for TinaCMS.
 *
 * This is a singleton collection (ui.global = true) that stores site-wide
 * settings like the site name, logo, social links, and footer content.
 * Editors manage it via a single settings panel in the /admin UI.
 *
 * See docs/SPEC.md Section 3.3 for the full data model.
 */
import type { Collection } from "tinacms";

const Global: Collection = {
  label: "Global Settings",
  name: "global",
  path: "content/global",
  format: "json",
  ui: {
    // Singleton — renders as a settings panel, not a document list.
    global: true,
  },
  fields: [
    {
      type: "string",
      label: "Site Name",
      name: "siteName",
      description: "Displayed in the header and browser tab.",
    },
    {
      type: "string",
      label: "Site Description",
      name: "siteDescription",
      description: "Default meta description for SEO.",
    },
    {
      type: "image",
      label: "Logo",
      name: "logo",
      description: "Site logo shown in the header navigation.",
    },
    {
      type: "image",
      label: "Default Hero Image",
      name: "defaultHeroImage",
      description: "Fallback hero image when a page-specific image is not set.",
    },
    {
      type: "object",
      label: "Social Links",
      name: "socialLinks",
      list: true,
      description: "Links shown in the footer (Discord, GitHub, YouTube, etc.).",
      ui: {
        itemProps: (item) => ({
          label: item?.platform || "New Link",
        }),
      },
      fields: [
        {
          type: "string",
          label: "Platform",
          name: "platform",
          description: "Display name (e.g. 'Discord', 'GitHub', 'YouTube').",
          required: true,
        },
        {
          type: "string",
          label: "URL",
          name: "url",
          description: "Full URL to the social profile or server.",
          required: true,
        },
      ],
    },
    {
      type: "rich-text",
      label: "Footer Content",
      name: "footer",
      description:
        "Footer text, disclaimers, and attribution. Rendered below the social links.",
    },
  ],
};

export default Global;
