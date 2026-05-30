/**
 * VideoClip — Renders a WebM clip as an autoplay looping inline video.
 *
 * Behaves like a high-quality GIF: muted, looping, no controls.
 * Uses IntersectionObserver to play/pause based on viewport visibility,
 * preventing bandwidth waste when many clips are on one page.
 *
 * Audio: clips autoplay muted (required by browser autoplay policy).
 * Users click the speaker icon to toggle audio on/off. Click is required
 * because browsers do not allow unmuted playback without a user gesture
 * (hover doesn't count — it causes the browser to kill the video).
 * When the clip scrolls out of view, audio is automatically re-muted.
 *
 * iOS constraints: `muted` + `playsInline` are required for autoplay on
 * Safari. Low Power Mode may still reject .play() — the Promise rejection
 * is caught silently.
 *
 * See docs/SPEC.md Section 5.5 for the full video strategy.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [isMuted, setIsMuted] = useState(true);

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
          // Re-mute when scrolled out so it doesn't blare audio when scrolled back in
          video.muted = true;
          setIsMuted(true);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Toggle mute on click. A click is a valid user gesture, so the browser
  // allows unmuted playback. If unmuting causes the browser to pause the
  // video (shouldn't happen with a click, but just in case), restart it.
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMuted(newMuted);

    if (!newMuted && video.paused) {
      video.play().catch(() => {});
    }
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
    <div className={cn("group relative", className)}>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        onError={() => setHasError(true)}
        className="w-full h-full rounded-lg border border-border bg-black"
      >
        <source src={resolveVideoSrc(src)} type="video/webm" />
      </video>

      {/* Click-to-toggle mute button — visible on hover in the bottom-right corner */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute video" : "Mute video"}
        className="absolute bottom-2 right-2 rounded-sm bg-black/60 p-1.5 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80 hover:text-white cursor-pointer"
      >
        {isMuted ? (
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-3.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-3.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        ) : (
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-3.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-3.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
