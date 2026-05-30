/**
 * BossHero — Header section for the boss detail page.
 *
 * Displays the boss thumbnail as a banner background with overlaid metadata:
 * name, region, location, difficulty, boss type, and a rich-text description.
 *
 * See docs/SPEC.md Section 4.3 "Move Entry" → boss detail page design.
 */
import Image from "next/image";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { cn } from "@/lib/utils";

/** Color mapping matching BossCard difficulty badges */
const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-green-600/80",
  Medium: "bg-yellow-600/80",
  Hard: "bg-orange-600/80",
  "Very Hard": "bg-red-600/80",
};

interface BossHeroProps {
  name: string;
  thumbnail: string;
  region: string;
  difficulty: string;
  description?: Parameters<typeof TinaMarkdown>[0]["content"];
}

export function BossHero({
  name,
  thumbnail,
  region,
  difficulty,
  description,
}: BossHeroProps) {
  return (
    <section className="relative mb-8">
      {/* Thumbnail banner with gradient overlay */}
      <div className="relative h-48 sm:h-64 lg:h-80 overflow-hidden rounded-lg">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      {/* Boss metadata overlaid on the banner */}
      <div className="relative -mt-20 px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-xs font-bold text-white",
              DIFFICULTY_COLORS[difficulty] || "bg-muted"
            )}
          >
            {difficulty}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-accent mb-1">
          {name}
        </h1>

        <p className="text-sm text-muted-foreground mb-4">
          {region}
        </p>

        {/* Rich-text description (lore blurb, general strategy overview) */}
        {description && (
          <div className="prose prose-invert prose-sm max-w-none text-foreground/90">
            <TinaMarkdown content={description} />
          </div>
        )}
      </div>
    </section>
  );
}
