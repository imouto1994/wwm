import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
}

// Derives up to 2 initials from an entry's name for the fallback box, e.g.
// "Longsword (Placeholder)" -> "LP". Falls back to "?" for an empty name.
function initialsFor(alt: string): string {
  const initials = alt
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

/**
 * Renders an entry's image via a plain <img> (works with PNG, JPEG, WEBP, or
 * SVG interchangeably - nothing here assumes a specific format), falling
 * back to a styled initials box if the image 404s or fails to decode. Keeps
 * the UI intact while placeholder art is swapped for real screenshots, and
 * protects against a data entry referencing a since-renamed/removed file.
 * Mirrors the boss-guide's "Clip unavailable" fallback pattern for broken
 * video (see docs/SPEC.md section 4.3).
 */
export function ImageWithFallback({ src, alt, className }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-surface-hover text-lg font-bold text-muted ${className ?? ''}`} role='img' aria-label={alt}>
        {initialsFor(alt)}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
