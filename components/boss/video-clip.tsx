/**
 * VideoClip — Renders a WebM clip as an autoplay looping inline video.
 *
 * Behaves like a high-quality GIF: muted, looping, no controls.
 * Uses IntersectionObserver to play/pause based on viewport visibility,
 * preventing bandwidth waste when many clips are on one page.
 *
 * iOS constraints: `muted` + `playsInline` are required for autoplay on
 * Safari. Low Power Mode may still reject .play() — the Promise rejection
 * is caught silently.
 *
 * See docs/SPEC.md Section 5.5 for the full video strategy.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Next.js auto-prefixes <Link> and <Image> with basePath, but NOT raw HTML
// elements like <video> or <source>. We read the basePath from the same env var
// that next.config.ts uses, so video src paths are correctly prefixed on GitHub Pages.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Resolves the video src, prepending basePath only for relative paths.
 * Tina Cloud rewrites local media paths (e.g. "/uploads/moves/foo.webm") into
 * absolute CDN URLs (e.g. "https://assets.tina.io/..."). We must NOT prepend
 * basePath to absolute URLs — only to relative paths starting with "/".
 */
function resolveVideoSrc(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return `${BASE_PATH}${src}`;
}

interface VideoClipProps {
  /** Path to the WebM file (relative to public/, e.g. "/uploads/moves/foo.webm") */
  src: string;
  className?: string;
}

export function VideoClip({ src, className }: VideoClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Play when >=50% visible, pause when scrolled away.
    // Threshold of 0.5 avoids flicker at viewport edges.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Silently catch: iOS Low Power Mode or browser policy may reject
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground text-sm rounded-lg aspect-video",
          className
        )}
      >
        Clip unavailable
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      preload="none"
      onError={() => setHasError(true)}
      className={cn("rounded-lg border border-border bg-black", className)}
    >
      <source src={resolveVideoSrc(src)} type="video/webm" />
    </video>
  );
}
