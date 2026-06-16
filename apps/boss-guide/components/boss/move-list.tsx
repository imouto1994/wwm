/**
 * MoveList — Renders an array of MoveEntry components with visual separators.
 *
 * Shows a "No moves documented yet" message when the list is empty,
 * matching the empty state design from docs/SPEC.md Section 4.3.
 */
import type { TinaMarkdownContent } from "tinacms/dist/rich-text";
import { MoveEntry } from "./move-entry";

interface Move {
  title: string;
  videoFile: string;
  description?: TinaMarkdownContent;
}

interface MoveListProps {
  moves: (Move | null)[] | null | undefined;
}

export function MoveList({ moves }: MoveListProps) {
  const validMoves = moves?.filter(
    (m): m is Move => m !== null && !!m.title && !!m.videoFile
  );

  if (!validMoves || validMoves.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No moves documented yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {validMoves.map((move, index) => (
        <div key={move.title}>
          <MoveEntry move={move} />
          {/* Visual separator between moves, but not after the last one */}
          {index < validMoves.length - 1 && (
            <hr className="mt-8 border-border" />
          )}
        </div>
      ))}
    </div>
  );
}
