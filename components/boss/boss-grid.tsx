/**
 * BossGrid — Client component for the boss index page.
 *
 * Receives the full list of bosses from the server component parent and
 * handles client-side filtering by region, difficulty, boss type, and
 * free-text search. Uses useMemo for filtered results — no external
 * search library needed since the dataset is bounded (<50 bosses).
 *
 * This must be a "use client" component because it uses useState for
 * filter state. The parent server component fetches data from TinaCMS
 * and passes it as props.
 *
 * See docs/SPEC.md Section 5.7 for the search/filtering strategy.
 */
"use client";

import { useMemo, useState } from "react";
import { BossCard } from "./boss-card";

interface BossItem {
  slug: string;
  name: string;
  thumbnail: string;
  difficulty: string;
  region: string;
}

interface BossGridProps {
  bosses: BossItem[];
}

/** All possible values for each filter dropdown */
const REGIONS = ["All", "Minzhou", "Langya", "Jiangnan", "Northern Desert", "Eastern Sea", "Other"];
const DIFFICULTIES = ["All", "Easy", "Medium", "Hard", "Very Hard"];
export function BossGrid({ bosses }: BossGridProps) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [difficulty, setDifficulty] = useState("All");

  const filtered = useMemo(() => {
    return bosses.filter((boss) => {
      if (region !== "All" && boss.region !== region) return false;
      if (difficulty !== "All" && boss.difficulty !== difficulty) return false;
      if (search && !boss.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [bosses, search, region, difficulty]);

  return (
    <div>
      {/* Filter controls */}
      <div className="mb-6 flex flex-col sm:flex-row flex-wrap gap-3">
        {/* Text search */}
        <input
          type="text"
          placeholder="Search bosses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />

        {/* Region filter */}
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r === "All" ? "All Regions" : r}
            </option>
          ))}
        </select>

        {/* Difficulty filter */}
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d === "All" ? "All Difficulties" : d}
            </option>
          ))}
        </select>

      </div>

      {/* Boss card grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {bosses.length === 0
            ? "No bosses added yet. Head to /admin to add your first boss."
            : "No bosses match your filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((boss) => (
            <BossCard key={boss.slug} {...boss} />
          ))}
        </div>
      )}
    </div>
  );
}
