# PvP Tournament Tracker - Agent Guide

Guidelines for working on the **PvP Tournament Tracker** (`apps/pvp`), one of four apps in this monorepo (the others are `apps/boss-guide`, `apps/reforge` and `apps/speedrun`). Read this before changing anything here. The full spec is [docs/pvp-app.md](../../docs/pvp-app.md).

## What this app is (and is not)

- A live tracker for the guild's 1v1v1 PvP tournament: 21, 24, 27 or 30 players, groups of three playing **first to 2 game wins** at every stage. The **viewer page** (`/`) shows the bracket live; the **host page** (`/host`, behind a PIN) is the one scorekeeper device that records results.
- Vite + React 18 + TypeScript + Tailwind 4, plus **one Vercel Function** (`api/tournament.ts`) backed by **Upstash Redis**. No router library, no accounts, no websockets: viewers poll.
- It does **not** run or schedule the fights, track KOs, or let viewers vote. Discord predictions happen in EasyPoll; the host imports the results, and they **never** affect the bracket.

## The one mental model that matters

The whole event is **one `Tournament` JSON document** ([src/types/tournament.ts](src/types/tournament.ts)). It stores only inputs: players, series, game placements, overrides, polls, tie draws. Standings, qualifiers, seeds, ETAs and the champion are all **derived** by pure functions in `src/lib`, so fixing a game result re-flows everything.

Every host change is an `Action` applied by the pure reducer `applyAction` ([src/lib/reducer.ts](src/lib/reducer.ts)). The host page applies it locally first (instant UI), then saves the **whole document** with the version it was based on. The server validates it and does a compare-and-set.

```
host tap --applyAction()--> new Tournament (shown at once) --PUT {expectedVersion, tournament}--> server
server  --parseTournament() + Redis CAS--> 200 (version + 1) | 409 (newer state returned, host reloads it)
viewer  --GET every 4 s (CDN-cached 2 s)--> Tournament --derive in src/lib--> bracket, standings, predictions
```

## Architecture

- `src/types/tournament.ts` - domain types. `Series` is the unit of play: three players, `winsNeeded` 1 or 2, a list of `Game` placements, plus an optional `winnerOverride` and `poll`. `Stage` runs `setup → groups → (playIn) → semis → final → done`.
- `src/lib/format.ts` - `SUPPORTED_COUNTS` and `formatFor(count)`: number of groups, runner-up spots (21 → 2, 24 → 1) and whether there's a play-in (30).
- `src/lib/series.ts` - per-series records (wins, points with 1st = 3 / 2nd = 1 / 3rd = 0, games), `seriesWinner` (an override wins over games), placement validation.
- `src/lib/ranking.ts` - `compareRecords` (wins, then points per game) and `rankRecords`, which applies recorded `TieDraw`s and reports the ties still unresolved.
- `src/lib/qualification.ts` - `groupStageOutcome` (winners, ranked runners-up, qualifiers, play-in line-up), `seedingOrder`, and `pendingTies` (ties that cross a cut and block `advance`).
- `src/lib/seeding.ts` - snake seeding of the 9 semifinalists (1-6-7 / 2-5-8 / 3-4-9), with the fewest swaps inside each seed tier to avoid first-round rematches.
- `src/lib/draw.ts` - Fisher-Yates shuffle and the random group draw.
- `src/lib/reducer.ts` - every host action, stage transitions (`advance`, `reopenStage`) and `replacementCandidates`. **Business rules go here**, not in components.
- `src/lib/validate.ts` - `parseTournament`: rebuilds a `Tournament` from untrusted JSON and **never throws**. The server runs it on every PUT and on every Redis read.
- `src/lib/polls.ts` - EasyPoll votes JSON → ballots matched to series players, vote shares, crowd favourite, prediction leaderboard, the poll question text.
- `src/lib/eta.ts` - "next series in about N minutes" from game timestamps only.
- `src/lib/apiClient.ts` - fetch wrappers for GET / PUT / history.
- `server/` - framework-free request handling shared by production and dev: `handler.ts` (routes, status codes, cache headers), `store.ts` (Redis store with a Lua compare-and-set, plus an in-memory store), `auth.ts` (host PIN check), `dev.ts` (the Vite middleware entry).
- `api/tournament.ts` - the Vercel Function; a thin wrapper around `server/handler.ts`.
- `src/hooks/` - `useTournamentFeed` (viewer polling, paused while the tab is hidden), `useHostTournament` (optimistic dispatch + serialized saves + conflict reload), `useHostPin` (sessionStorage), `useNow`.
- `src/components/` - shared `SeriesCard`, `ChampionBanner`, `Section`, `Button`, `Banner`, `CopyButton`; `viewer/*` (now playing, road to the semifinals, predictions, recent results); `host/*` (PIN gate, setup and draw, two-tap game entry, poll import, stage gate, host tools).
- `src/views/` - `ViewerApp` and `HostApp`. `src/App.tsx` picks one from the path (`/host` or anything else).

## Invariants that are easy to get wrong

- **Persist inputs only.** Never store standings, qualifiers, seeds or the champion in the document; derive them.
- **Ranking order is wins → points per game → recorded random draw.** KOs were dropped on purpose. Points per game (not total points) keeps 2-0 and 2-1 records comparable.
- **Random draws are recorded, never recomputed.** A tie is broken once by `resolveTies`, stored in `tieDraws` under a key of its context plus the sorted player ids (see `tieKey`), and replayed on every screen. Never call `Math.random` while deriving anything.
- **Only ties that change something get drawn.** `pendingTies` reports ties that decide a group's runner-up, a qualification or play-in cut, or any position in the semifinal seeding; `advance` refuses to run until they're drawn. Ties among runners-up who all miss out stay unresolved.
- **Results only change in the current stage.** Earlier stages need `reopenStage`, which deletes the current stage's series (going back from groups to setup is allowed only while no group has results).
- **The final is always first to 2.** The late-running rule (`lateRule`) only turns the **semifinals** into single matches, and only before any semifinal has a result. The play-in is always a single match.
- **Replacements are for semifinals and the final only, and only before the series has a game.** After that, use a winner override (it needs a public reason).
- **The server is the authority.** It sets `version = expectedVersion + 1` and `updatedAt` itself, rejects documents over 256 KB, and validates with `parseTournament`. Keep `parseTournament` in sync with any type change.
- **Relative `.js` imports in `src/lib`, `src/types`, `server/` and `api/`.** Vercel runs the function as plain Node ESM, which can't resolve the `@/` alias or extensionless paths. UI code (`components`, `hooks`, `views`) uses `@/`.
- **Redis keys are prefixed with `pvp:${VERCEL_ENV}`**, so a rehearsal on a preview deployment can't overwrite production (the free plan has one database). Keep `automaticDeserialization: false`; the store reads and writes raw JSON strings.
- **The host PIN fails closed.** With no `HOST_PIN`, nobody can write. The `dev` PIN exists only in the Vite middleware. Never log the PIN, request bodies or ballots.
- **Ballots are public.** `GET /api/tournament` returns the whole document, including each voter's Discord ID and username, because the prediction leaderboard needs them. Don't add anything more sensitive to the document.
- **`example.html` (the EasyPoll dashboard sample at the repo root) holds real members' Discord IDs.** Never commit it; the script's fixture uses fake IDs.

## Adding or changing behavior

1. Put rules in `src/lib` as pure functions (usually a new `Action` in `reducer.ts`), and wire the UI through `useHostTournament().dispatch`.
2. **No automated tests in this app, by the owner's choice.** Don't add test files or a test runner; check changes by running the dev server end to end (host and viewer tabs side by side).
3. Comments explain the *why* (a repo-wide rule).
4. **Update [docs/pvp-app.md](../../docs/pvp-app.md)** whenever rules, the data model, the API or the UI change.
5. If you change the document shape, bump `schemaVersion` and teach `parseTournament` to read the old shape: a tournament may be stored in Redis when you deploy.

## Commands (run from repo root)

- Dev: `pnpm dev:pvp` (http://localhost:2140, host page at `/host`). The Vite middleware serves `/api/tournament` from an in-memory store with host PIN `dev`. Put `HOST_PIN` and Upstash credentials in `apps/pvp/.env.local` to use a real PIN and Redis (keys `pvp:development:*`).
- Build + typecheck: `pnpm --filter wwm-pvp build` (`tsc --noEmit && vite build`)
- Lint/format: `pnpm lint` (Biome, workspace-wide). Always finish with build + lint green.
- EasyPoll votes → JSON for the poll import: paste [scripts/easypoll/easypoll-devtools.js](../../scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console on the poll's votes page (copies the JSON), or run `pnpm easypoll:json <table.html> [more.html] [-o votes.json]` on saved HTML. The snippet mirrors `parse-votes.mjs`; change both together.

## Conventions

- Biome formats with single quotes and a 160-character line width, and sorts imports; run `pnpm exec biome check --write apps/pvp` rather than fixing order by hand.
- Theme: reuse the wuxia tokens in [src/index.css](src/index.css) (`bg`, `surface`, `gold`, `border`, plus `green` for "through" and "live"). Mobile-first; the host page is used on a phone or a laptop next to the game.
- TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`; keep imports and params clean.
- User-facing copy is plain English for guild members ("first to 2", "points per game"), not tournament jargon.

## Deployment

Deploys to **Vercel** as its own project (Root Directory `apps/pvp`, Vite preset, output `dist/`); `api/tournament.ts` becomes the only function. Connect **Upstash Redis** from the Vercel Marketplace (it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`), and set **`HOST_PIN`** for Production and Preview. After the event, set `READ_ONLY=1` to keep the results visible while refusing writes. The Node version comes from the **root** `package.json` `engines.node` (`24.x`, mirrored in `apps/pvp/package.json`). Creating the project and the database is a manual dashboard step; the runbook is [docs/pvp-deploy.md](../../docs/pvp-deploy.md).
