/**
 * Home page — MVP landing showing all bosses in a grid.
 *
 * Fetches all bosses from TinaCMS at build time (SSG) and renders them
 * using BossCard components. For Phase 2, this will be enhanced with a
 * hero section and featured bosses.
 *
 * See docs/SPEC.md Section 2.1 and 8.1 for page description and user flows.
 */
import Link from "next/link";
import client from "@/tina/__generated__/client";
import { BossCard } from "@/components/boss/boss-card";

export default async function Home() {
  let bosses: Array<{
    slug: string;
    name: string;
    thumbnail: string;
    difficulty: string;
    region: string;
  }> = [];

  try {
    const { data } = await client.queries.bossConnection();

    bosses =
      data.bossConnection.edges
        ?.filter((edge) => edge?.node)
        .map((edge) => {
          const node = edge!.node!;
          return {
            slug: node._sys.filename,
            name: node.name,
            thumbnail: node.thumbnail,
            difficulty: node.difficulty,
            region: node.region,
          };
        }) ?? [];
  } catch {
    // Graceful degradation: show empty state if TinaCMS is unreachable
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Hero section — minimal MVP, enhanced in Phase 2 */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-accent mb-2">
          WWM Boss Guide
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          The definitive moveset encyclopedia for <em>Where Winds Meet</em>.
          Learn to parry and dodge every boss attack with video guides.
        </p>
      </div>

      {/* Boss grid */}
      {bosses.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {bosses.map((boss) => (
              <BossCard key={boss.slug} {...boss} />
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/bosses"
              className="text-xs text-accent hover:underline"
            >
              View all bosses with filters →
            </Link>
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          No bosses added yet.{" "}
          <Link href="/admin" className="text-accent hover:underline">
            Head to /admin to add your first boss.
          </Link>
        </div>
      )}
    </div>
  );
}
