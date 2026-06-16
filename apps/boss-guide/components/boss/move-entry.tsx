/**
 * MoveEntry — Displays a single move: WebM clip + title + description.
 *
 * Layout:
 * - Mobile: full-width clip stacked above title and description
 * - Desktop (lg+): clip on the left, title + description on the right
 *
 * The description is a TinaCMS rich-text field rendered via TinaMarkdown.
 * If no description is provided, only the title is shown beside the clip.
 *
 * See docs/SPEC.md Section 4.3 "Move Entry" for design details.
 */
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { VideoClip } from "./video-clip";

interface MoveEntryProps {
  move: {
    title: string;
    videoFile: string;
    description?: Parameters<typeof TinaMarkdown>[0]["content"];
  };
}

export function MoveEntry({ move }: MoveEntryProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Video clip — 16:9 aspect ratio, fills half width on desktop */}
      <div className="w-full lg:w-1/2 shrink-0">
        <VideoClip
          src={move.videoFile}
          className="w-full aspect-video"
        />
      </div>

      {/* Text content — title and optional rich-text description */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-accent">
          {move.title}
        </h3>
        {move.description && (
          <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
            <TinaMarkdown content={move.description} />
          </div>
        )}
      </div>
    </div>
  );
}
