/**
 * Boss index page — filterable grid of all bosses.
 *
 * This is a server component that fetches all bosses from TinaCMS at
 * build time, then passes the data to BossGrid (a client component)
 * which handles filtering with useState. This server/client split is
 * required because server components cannot use React hooks.
 *
 * See docs/SPEC.md Section 5.7 for the filtering strategy.
 */
import type { Metadata } from "next";
import client from "@/tina/__generated__/client";
import { BossGrid } from "@/components/boss/boss-grid";

export const metadata: Metadata = {
  title: "All Bosses",
  description:
    "Browse and filter all boss encounters in Where Winds Meet. Find parry and dodge guides for every boss.",
};

export default async function BossesPage() {
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
    // Graceful degradation
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-accent mb-6">All Bosses</h1>
      <BossGrid bosses={bosses} />
    </div>
  );
}
