/**
 * BossCard — Grid card for the boss index page.
 *
 * Shows the boss thumbnail with overlaid name, difficulty badge, and boss
 * type pill. Links to the boss detail page. Includes a hover scale effect
 * with a subtle gold glow border.
 *
 * Uses Next.js <Image> with `fill` layout inside a fixed-aspect container
 * for optimized image loading.
 *
 * See docs/SPEC.md Section 4.3 "Boss Card" for design details.
 */
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Color mapping for the difficulty badge */
const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-green-600/80",
  Medium: "bg-yellow-600/80",
  Hard: "bg-orange-600/80",
  "Very Hard": "bg-red-600/80",
};

interface BossCardProps {
  slug: string;
  name: string;
  thumbnail: string;
  difficulty: string;
  region: string;
}

export function BossCard({
  slug,
  name,
  thumbnail,
  difficulty,
  region,
}: BossCardProps) {
  return (
    <Link
      href={`/bosses/${slug}`}
      className={cn(
        "group relative block overflow-hidden rounded-lg border border-border",
        "bg-card transition-all duration-300",
        "hover:scale-[1.02] hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10"
      )}
    >
      {/* 16:9 aspect ratio container with thumbnail */}
      <div className="relative aspect-video">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}

        {/* Bottom gradient overlay for name readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Difficulty badge — top-right */}
        <span
          className={cn(
            "absolute top-2 right-2 rounded-sm px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm",
            DIFFICULTY_COLORS[difficulty] || "bg-muted"
          )}
        >
          {difficulty}
        </span>

        {/* Boss name — bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{name}</h3>
          <p className="text-xs text-white/70">{region}</p>
        </div>
      </div>
    </Link>
  );
}
