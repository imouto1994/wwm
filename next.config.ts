/**
 * Next.js configuration for static export to GitHub Pages.
 *
 * Key settings:
 * - output: 'export' — produces a static `out/` directory (no Node server needed)
 * - basePath — derived from NEXT_PUBLIC_BASE_PATH env var (e.g. "/wwm" for GitHub Pages)
 * - trailingSlash — generates /bosses/luo-yiren/index.html for clean URLs on GitHub Pages
 * - images.unoptimized — disables the Image Optimization API (requires a server)
 *
 * The NEXT_PUBLIC_BASE_PATH env var is the single source of truth for the base path.
 * It's set by the build:gh-pages script and also used by video-clip.tsx to prefix
 * <video> src paths (which Next.js does NOT auto-prefix unlike <Link> and <Image>).
 *
 * Local dev: env var is not set → basePath is "" → no prefix, works on localhost:2110.
 * Production: build:gh-pages sets NEXT_PUBLIC_BASE_PATH=/wwm → all routes prefixed.
 */
import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.tina.io",
        port: "",
      },
    ],
  },
  // Note: headers and rewrites are not supported with output: 'export'.
  // The TinaCMS admin is accessible directly at /admin/index.html.
};

export default nextConfig;
