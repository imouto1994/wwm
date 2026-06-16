/**
 * Boss collection schema for TinaCMS.
 *
 * Each boss is an MDX file under content/bosses/ with structured frontmatter
 * for all boss metadata and an embedded list of moves. The MDX body is
 * intentionally unused — all content lives in queryable frontmatter fields.
 *
 * See docs/SPEC.md Section 3.1 and 6.1 for the full data model.
 */
import type { Collection } from "tinacms";

const Boss: Collection = {
  label: "Bosses",
  name: "boss",
  path: "content/bosses",
  format: "mdx",
  ui: {
    // Links the TinaCMS admin "view on site" button to the boss detail page.
    // TinaCMS uses the filename (e.g. luo-yiren.mdx) as the slug automatically.
    router: ({ document }) => `/bosses/${document._sys.filename}`,
  },
  fields: [
    {
      type: "string",
      label: "Boss Name",
      name: "name",
      isTitle: true,
      required: true,
    },
    {
      type: "image",
      label: "Thumbnail",
      name: "thumbnail",
      description: "Boss portrait or screenshot. Displayed on boss cards and the detail page hero.",
      required: true,
    },
    {
      type: "string",
      label: "Region",
      name: "region",
      description: "Game region or chapter where this boss appears.",
      required: true,
      options: [
        "Minzhou",
        "Langya",
        "Jiangnan",
        "Northern Desert",
        "Eastern Sea",
        "Other",
      ],
    },
    {
      type: "string",
      label: "Difficulty",
      name: "difficulty",
      required: true,
      options: ["Easy", "Medium", "Hard", "Very Hard"],
    },
    {
      type: "rich-text",
      label: "Description",
      name: "description",
      description:
        "Lore blurb and general overview. Shown in the boss hero section. Also used for SEO meta description.",
    },
    {
      type: "object",
      label: "Moves",
      name: "moves",
      list: true,
      description:
        "Each move is a WebM clip + title + description showing one attack and how to counter it.",
      ui: {
        // Show the move title in the CMS list for easy identification.
        itemProps: (item) => ({
          label: item?.title || "New Move",
        }),
      },
      fields: [
        {
          type: "string",
          label: "Title",
          name: "title",
          description:
            'Name of the move and counter type (e.g. "Sweeping Crane Kick — Parry").',
          required: true,
        },
        {
          type: "image",
          label: "Video Clip (WebM)",
          name: "videoFile",
          description:
            "Short WebM clip (3-15s, 720p, <1MB). Despite the 'image' field type, " +
            "TinaCMS media manager supports video/* uploads including .webm.",
          required: true,
        },
        {
          type: "rich-text",
          label: "Description",
          name: "description",
          description:
            "Explain what the boss does, how to counter it, timing tips, and input hints.",
        },
      ],
    },
  ],
};

export default Boss;
