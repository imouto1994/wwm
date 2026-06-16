/**
 * TinaCMS configuration.
 *
 * Registers the Boss and Global collections, configures Git-based media
 * storage (public/uploads/), and explicitly allows WebM video uploads
 * alongside standard image formats.
 *
 * Environment variables (only needed for Tina Cloud in production):
 * - NEXT_PUBLIC_TINA_CLIENT_ID: project client ID from app.tina.io
 * - TINA_TOKEN: API token (server-side only)
 * - NEXT_PUBLIC_TINA_BRANCH: Git branch for content
 *
 * For local development, `pnpm dev` runs TinaCMS in local mode without
 * any env vars — content is read/written directly from the filesystem.
 */
import { defineConfig } from "tinacms";
import nextConfig from "../next.config";

import Boss from "./collection/boss";
import Global from "./collection/global";

const config = defineConfig({
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID!,
  branch:
    process.env.NEXT_PUBLIC_TINA_BRANCH! ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF! ||
    process.env.HEAD!,
  token: process.env.TINA_TOKEN!,
  media: {
    tina: {
      publicFolder: "public",
      mediaRoot: "uploads",
    },
    // Explicitly allow WebM video uploads alongside images.
    // TinaCMS supports video/* by default, but being explicit avoids surprises.
    accept: ["image/*", "video/webm"],
  },
  build: {
    publicFolder: "public",
    outputFolder: "admin",
    basePath: nextConfig.basePath?.replace(/^\//, "") || "",
  },
  schema: {
    collections: [Boss, Global],
  },
});

export default config;
