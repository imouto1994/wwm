# PvP Tournament Tracker - Agent Guide

Guidelines for working on the **PvP Tournament Tracker** (`apps/pvp`), one of four apps in this monorepo (the others are `apps/boss-guide`, `apps/reforge` and `apps/speedrun`). Read this before changing anything here. The full spec is [docs/pvp-app.md](../../docs/pvp-app.md).

## What this app is (and is not)

- A live tracker for the guild's 1v1v1 PvP tournament: 21, 24, 27 or 30 players, groups of three playing **first to 2 game wins** (the grand final **first to 3**), with the host able to rearrange line-ups and decide the semifinal spots the group winners don't fill exactly. The **viewer page** (`/`) shows the bracket live; the **host page** (`/host`, behind a PIN) is the one scorekeeper device that records results. Both pages are in **Vietnamese by default**, with English as the alternative.
- Vite + React 18 + TypeScript + Tailwind 4, plus **one Vercel Function** (`api/tournament.ts`) backed by **Upstash Redis**. No router library, no accounts, no websockets: viewers poll.
- It does **not** run or schedule the fights, track KOs, or let viewers vote. Discord predictions happen in EasyPoll; the host imports the results, and they **never** affect the bracket.

## The one mental model that matters

The whole event is **one `Tournament` JSON document** ([src/types/tournament.ts](src/types/tournament.ts)). It stores only inputs: players (Discord usernames), the username → display name list, series, game placements, overrides, polls, tie draws. Standings, qualifiers, ETAs, the final's places and the leaderboard's places are all **derived** by pure functions in `src/lib`, so fixing a game result re-flows everything.

Every host change is an `Action` applied by the pure reducer `applyAction` ([src/lib/reducer.ts](src/lib/reducer.ts)). The host page applies it locally first (instant UI), then saves the **whole document** with the version it was based on. The server validates it and does a compare-and-set.

```
host tap --applyAction()--> new Tournament (shown at once) --PUT {expectedVersion, tournament}--> server
server  --parseTournament() + Redis CAS--> 200 (version + 1) | 409 (newer state returned, host reloads it)
viewer  --GET every 4 s (CDN-cached 2 s)--> Tournament --derive in src/lib--> bracket, standings, predictions
```

## Architecture

- `src/types/tournament.ts` - domain types. `Series` is the unit of play: three players, `winsNeeded` 1, 2 or 3, a list of `Game` placements, plus an optional `winnerOverride`, the winner `poll` and the over/under `gamesPoll`. `Stage` runs `setup → groups → (survival, 30 players only) → semis → final → done`. `semifinalPicks` holds the host's fill-ins at 21/24 players. `players` are Discord usernames and `displayNames` maps usernames to the names screens show.
- `src/lib/names.ts` - `normalizeUsername` (trim, drop "@", lowercase: the stored form), `isDiscordUsername` (Discord's 2–32 a–z0–9_. rule), `nameLookup` (display name, else the username) and `parseDisplayNamesJson` for the host's pasted list.
- `src/lib/format.ts` - `SUPPORTED_COUNTS` and `formatFor(count)`: number of groups, empty semifinal spots the host fills (`fillInSpots`: 21 → 2, 24 → 1) and extra winners the survival game knocks out (`dropSpots`: 30 → 1). Also `WINS_NEEDED` per phase (survival game 1, final 3) and the fixed over/under lines `GAMES_LINES` (2.5 / 2.5 / 4.5, with the calculation behind them in the comment; the survival game has none).
- `src/lib/series.ts` - per-series records (wins, points with 1st = 3 / 2nd = 1 / 3rd = 0, games), `seriesWinner` (an override wins over games), placement validation.
- `src/lib/ranking.ts` - `compareRecords` (wins, then points per game) and `rankRecords`, which applies recorded `TieDraw`s and reports the ties still unresolved.
- `src/lib/qualification.ts` - `groupStageOutcome` (group winners and records), `survivalPlan` (30 players: winners ranked weakest last, the tie at the seat cut, and the 3 seats once settled) and `survivalSeriesFrom`, `semifinalSelection` (pick candidates by record, the picks that still fit the results, the survival game's loser, and the 9 semifinalists once complete), `pendingTies` (the survival seat tie that blocks `advance`), `semifinalGroups` (the host's random draw while it still holds the current semifinalists) and `semifinalSeriesFrom`.
- `src/lib/draw.ts` - `shuffle`, the random group draw, and `drawSemifinalGroups` (random 3×3 split that redraws until no two first-round group mates share a group).
- `src/lib/draw.ts` - Fisher-Yates shuffle and the random group draw.
- `src/lib/reducer.ts` - every host action, stage transitions (`advance`, `reopenStage`) and `replacementCandidates`. **Business rules go here**, not in components.
- `src/lib/validate.ts` - `parseTournament`: rebuilds a `Tournament` from untrusted JSON and **never throws**. The server runs it on every PUT and on every Redis read.
- `src/lib/polls.ts` - EasyPoll votes JSON → winner ballots (voters keyed by normalized username; answers are display names, read back to usernames with `displayNameIndex`) and over/under ballots (`parseGamesPick`, keywords in both languages), vote shares derived from the ballots, `gamesOutcome` (over / under / push, or undefined while running, for single matches and rulings), `pollAnswer` (the right answer to a series' first poll: the winner, or for the survival game the player who went out), crowd records, prediction leaderboard and `leaderboardPlaces` (its prize places).
- `src/lib/i18n.ts` - **all user-facing text**: one `en` mapping that defines the shape and a `vi` mapping typed to match it, plus `Translatable`, `formatDecimal`, `formatAgo`, `formatClockTime` and `describeRecord`.
- `src/lib/eta.ts` - "next series in about N minutes" from game timestamps only.
- `src/lib/apiClient.ts` - fetch wrappers for GET / PUT / history; failures are `ApiError`s (status, server detail) and `describeApiError` turns them into a `Translatable`.
- `server/` - framework-free request handling shared by production and dev: `handler.ts` (routes, status codes, cache headers), `store.ts` (Redis store with a Lua compare-and-set, plus an in-memory store), `auth.ts` (host PIN check), `dev.ts` (the Vite middleware entry).
- `api/tournament.ts` - the Vercel Function; a thin wrapper around `server/handler.ts`.
- `src/hooks/` - `useI18n` (`I18nProvider`: the selected locale in `localStorage`, Vietnamese by default; gives components `t`, `locale` and `decimal`), `useTournamentFeed` (viewer polling, paused while the tab is hidden), `useHostTournament` (optimistic dispatch + serialized saves + conflict reload), `useHostPin` (sessionStorage), `useNow`.
- `src/components/` - shared `SeriesCard`, `ChampionBanner`, `Section`, `Button`, `Banner`, `CopyButton`, `LocaleSwitch`; `viewer/*` (now playing, road to the semifinals, the prediction leaderboard as `PredictionsBoard` in the side column and `PredictionsDock` on phones, recent results, plus the `Seal` stamps and the `InkBackdrop` scenery); `host/*` (PIN gate, setup and draw, `DisplayNamesEditor` and the shared `JsonField`, `RearrangePanel` tap-to-swap, two-tap game entry, poll import, stage gate with `SemifinalPicker`, host tools).
- `src/views/` - `ViewerApp` and `HostApp`. `src/App.tsx` picks one from the path (`/host` or anything else).

## Invariants that are easy to get wrong

- **Persist inputs only.** Never store standings, qualifiers, places or the champion in the document; derive them. (The semifinal draw is stored because it's a random input, like the group draw.)
- **Ranking order is wins → points per game → recorded random draw.** KOs were dropped on purpose. Points per game (not total points) keeps 2-0 and 2-1 records comparable.
- **Random draws are recorded, never recomputed.** A tie is broken once by `resolveTies`, stored in `tieDraws` under a key of its context plus the sorted player ids (see `tieKey`), and replayed on every screen. Never call `Math.random` while deriving anything.
- **At 21/24 players the host, not a formula, fills the empty semifinal spots** with non-winners. There is no runner-up ranking and no play-in, by the owner's choice. Candidates are only *ordered* by record as a guide. `semifinalSelection` ignores picks that no longer fit the results (an undone game can turn a fill-in into a winner), so validate picks by deriving, not by trusting the stored list.
- **At 30 players the survival game, not the host, removes the extra winner**, also by the owner's choice: the 3 group winners with the fewest game wins, then the lowest points per game, play one game and 3rd place is out. A tie straddling the seat cut is settled by a recorded draw; the rest of that tie is safe. Who went out is derived from the game (`survivalLoser`), never stored. The survival game takes no winner rulings: an absent player is saved in 3rd.
- **Only the survival seat tie gets drawn.** `pendingTies` reports the tie at the survival seat cut once every group is decided; `advance` refuses to run until it's drawn. There's no seeding any more, so old `seeding:` tie draws in stored documents are inert.
- **The semifinal groups are a random draw, private until they start**, both by the owner's choice. The host presses "Draw the semifinal groups" (`drawSemifinals`, stored in `semifinalDraft`), can swap players (`arrangeSemifinals`) or redraw, and `advance` starts exactly those groups via `semifinalSeriesFrom`. `semifinalGroups` returns the draw only while it holds exactly the current semifinalists. **The viewer must not show it**: semifinal line-ups appear only once the semifinal series exist. New picks clear the draw; `reopenStage` from the semifinals writes the started groups back into it.
- **The final has three prize places.** `seriesPlacings` (via `finalStandings`) ranks the two non-winners by points scored in the final; level on points, both are 2nd and there's no 3rd. Show all three wherever the champion appears.
- **Leaderboard prize places minimise winners.** `leaderboardPlaces`: members level on correct picks and picks share a place; places go to whole tie groups in order and stop once three members hold one (two sharing 1st plus one 2nd means no 3rd). Keep this rule in `polls.ts`, not in components.
- **Swaps only touch series without results.** `swapPlayers` works in setup, the group stage and the semifinals, between two different series that both have no game and no override. Rematches in a rearranged semifinal are a warning in the UI, not a rule.
- **People are Discord usernames; names come from `displayNames`.** Participants are entered by username and voters arrive by username (EasyPoll's votes table shows it), so never key anything on a display name. Always pass usernames through `normalizeUsername` before storing or comparing. Numeric Discord IDs are not used or stored, by the owner's choice. Render names with `nameLookup(tournament)`. `setDisplayNames` replaces the whole list and enforces: valid usernames with no repeats after normalizing, names 1–32 characters, unique under `normalizeAnswer` (case and leading emoji ignored), and every current participant keeps a name. `setPlayers` requires a name for each username. Name uniqueness is what lets `displayNameIndex` read a winner-poll answer back to one username; don't relax it without changing the importer. The list includes non-playing predictors and survives `reset`.
- **Version 1 documents still load.** They stored `{ id: 'p1', name }` players and ballots with a `discordId` plus `username`; `parseTournament` keeps the player ids, moves the names into `displayNames`, and keys each ballot by its normalized username (the Discord ID only when the username is empty). That's why the validator checks only the shape, and username format and uniqueness live in the reducer.
- **Polls are recorded only from the votes JSON.** `poll` and `gamesPoll` hold `ballots` (at least one, one per Discord member), never typed counts; vote counts and shares are derived from them. That keeps the predictor leaderboard complete for every recorded poll, by the owner's choice, so don't add a counts fallback back. `parseTournament` drops old counts-only polls instead of rejecting the document.
- **A changed line-up clears that series' predictions.** Swaps and `replacePlayer` drop both `poll` and `gamesPoll` (`withoutPolls`): the votes were for the old line-up, and a winner poll with a vote for a departed player would fail `parseTournament`.
- **Over/under rules.** Every series except a single match carries it (`hasGamesPrediction`). The line is **fixed per phase** in `GAMES_LINES`, not chosen by the host; don't add a picker back without re-running the analysis in the `format.ts` comment (half-lines closest to a 50/50 split). A recorded `gamesPoll.line` is what counts, so changing the constants never reinterprets old votes. A ruling **voids** the prediction; pushes can only happen with a whole-number line, and neither counts for the crowd record or the leaderboard.
- **Results only change in the current stage.** Earlier stages need `reopenStage`, which deletes the current stage's series (going back from groups to setup is allowed only while no group has results).
- **Semifinals are always first to 2 and the final first to 3** (`WINS_NEEDED`). The owner removed the late-running rule that could cut semifinals to one game; old documents' `lateRule` key is dropped on load.
- **A reserve swap changes who is in the event.** `replacePlayer` in a group (setup or group stage, no game or ruling yet) brings in a named non-participant and replaces the leaver in `players` too, keeping the rest of the draw. It drops tie draws, picks and drafts that still name the leaver, because `parseTournament` rejects unknown players. In the semifinals and final, replacements are existing participants only.
- **Replacements are for semifinals and the final only, and only before the series has a game.** After that, use a winner override (it needs a public reason).
- **The server is the authority.** It sets `version = expectedVersion + 1` and `updatedAt` itself, rejects documents over 256 KB, and validates with `parseTournament`. Keep `parseTournament` in sync with any type change.
- **Relative `.js` imports in `src/lib`, `src/types`, `server/` and `api/`.** Vercel runs the function as plain Node ESM, which can't resolve the `@/` alias or extensionless paths. UI code (`components`, `hooks`, `views`) uses `@/`.
- **Redis keys are prefixed with `pvp:${VERCEL_ENV}`**, so a rehearsal on a preview deployment can't overwrite production (the free plan has one database). Keep `automaticDeserialization: false`; the store reads and writes raw JSON strings.
- **The host PIN fails closed.** With no `HOST_PIN`, nobody can write. The `dev` PIN exists only in the Vite middleware. Never log the PIN, request bodies or ballots.
- **Ballots and display names are public.** `GET /api/tournament` returns the whole document, including each voter's Discord username and the whole display-name list (people who never vote too), because the screens and the prediction leaderboard need them. Don't add anything more sensitive to the document.
- **`example.html` (the EasyPoll dashboard sample at the repo root) holds real members' Discord IDs.** Never commit it; the script's fixture uses fake IDs.
- **No hard-coded UI text.** Every string a person reads comes from `src/lib/i18n.ts`, in both `en` and `vi` (the type makes a missing Vietnamese entry a compile error). Rules code returns a `Translatable` (`(t) => t.errors.…`) instead of a string, so messages render in the language selected at display time. When storing one in React state, wrap it (`setX(() => message)`), or React will call it as an updater.
- **Two themes, one set of components.** The host console is dark; the viewer page is light "rice paper and ink". `index.html` adds `wuxia` to `<html>` on every path but `/host` (mirroring `IS_HOST` in `App.tsx`), and `html.wuxia` in `index.css` redefines Tailwind's colour variables, so shared components (`SeriesCard`, `Section`, `ChampionBanner`, `LocaleSwitch`) restyle themselves. Use the colour tokens (`bg-surface`, `text-fg`, `border-border`, …) rather than raw colours in shared components. Viewer-only decoration goes through hook classes styled under `.wuxia` (`series-card`, `place-chip`, `win-pip`, `champion-banner`, `section-title`), never through changes that would show on the host page. Every animation sits under `.wuxia` and is switched off by `prefers-reduced-motion`.
- **Seal glyphs are subset.** The Ma Shan Zheng font is requested in `index.html` with `text=` limited to the Chinese characters the seals use. Adding a seal character means adding it to that URL, or it renders in a fallback font.
- **The prediction leaderboard is always visible on the viewer page**, by the owner's choice: a sticky side column at `lg` and up, a bottom dock that opens a sheet below that. Don't move it back into the scrolling column.
- **Show series names with `t.seriesName(series)`**, never `series.label`: the stored label is English-only and kept for older documents.

## Visual style

Read the full guide in [docs/pvp-app.md §6.4](../../docs/pvp-app.md#64-visual-style-guide) before any UI work. The owner loves the current look, so extend it rather than reinvent it. In short:

- **Two personalities.** The viewer page is a living martial-arts scroll: playful, artistic, warm, light "rice paper and ink", never a corporate dashboard. The host page is the scorekeeper's desk: dark, plain, fast and undecorated. Keep both.
- **Build viewer UI from the existing pieces.** Use the colour tokens, the `paper` surface, `<Seal>` stamps (`components/viewer/Seal.tsx`), `Section` with a seal `icon`, and coins and ink pips on cards.
- **Fonts.** Alegreya for text. Water Brush only for large display text (the title, the champion, flourishes), never small text or numbers. Ma Shan Zheng only inside seals.
- **Colour.** Cinnabar red is the stamp, not the paint: seals, brush strokes, the live card and errors only. Ochre gold marks winners and jade marks "through".
- **Motion marks real events** (a stamp, an ink drop, a slide); ambient motion lives in `InkBackdrop`. Animate transform and opacity, scope it under `.wuxia`, and honour reduced motion.
- **Decoration is `aria-hidden` and never the only carrier of meaning.** Text must read well in both languages, so check Vietnamese diacritics and the longer Vietnamese strings.
- **Before finishing UI work,** check a 390 px phone and a desktop at 1024 px or wider, both languages, reduced motion, and that `/host` looks unchanged. Update §6.4 when you add a motif, colour, glyph or animation.

## Adding or changing behavior

1. Put rules in `src/lib` as pure functions (usually a new `Action` in `reducer.ts`), and wire the UI through `useHostTournament().dispatch`. Add any new text to both mappings in `src/lib/i18n.ts`.
2. **No automated tests in this app, by the owner's choice.** Don't add test files or a test runner; check changes by running the dev server end to end (host and viewer tabs side by side).
3. Comments explain the *why* (a repo-wide rule).
4. **Update [docs/pvp-app.md](../../docs/pvp-app.md)** whenever rules, the data model, the API or the UI change. If a host step, a host button label or a host tool changes, also update the host's event-day list, [docs/pvp-host-checklist.md](../../docs/pvp-host-checklist.md).
5. If you change the document shape, bump `schemaVersion` and teach `parseTournament` to read the old shape: a tournament may be stored in Redis when you deploy.

## Commands (run from repo root)

- Dev: `pnpm dev:pvp` (http://localhost:2140, host page at `/host`). The Vite middleware serves `/api/tournament` from an in-memory store with host PIN `dev`. Put `HOST_PIN` and Upstash credentials in `apps/pvp/.env.local` to use a real PIN and Redis (keys `pvp:development:*`).
- Build + typecheck: `pnpm --filter wwm-pvp build` (`tsc --noEmit && vite build`)
- Lint/format: `pnpm lint` (Biome, workspace-wide). Always finish with build + lint green.
- EasyPoll votes → `[{ username, vote }]` JSON for the poll import: paste [scripts/easypoll/easypoll-devtools.js](../../scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console on the poll's votes page (copies the JSON), or run `pnpm easypoll:json <table.html> [more.html] [-o votes.json]` on saved HTML. The snippet mirrors `parse-votes.mjs`; change both together.

## Conventions

- Biome formats with single quotes and a 160-character line width, and sorts imports; run `pnpm exec biome check --write apps/pvp` rather than fixing order by hand.
- Theme: use the colour tokens in [src/index.css](src/index.css) (`bg`, `surface`, `fg`, `muted`, `gold`, `red`, `green`, `border`); they resolve to the dark palette on the host page and to rice paper and ink on the viewer page (see "Visual style" above). Mobile-first; the host page is used on a phone or a laptop next to the game.
- TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`; keep imports and params clean.
- User-facing copy is plain language for guild members ("first to 2" / "chạm 2", "first to 3" / "chạm 3", "points per game" / "điểm mỗi ván"), not tournament jargon. Vietnamese uses "BTC" for the host, "Bảng" for groups, "ván" for games and "trận" for a series. Write the Vietnamese as a native speaker would, not as a word-for-word translation.

## Deployment

Deploys to **Vercel** as its own project (Root Directory `apps/pvp`, Vite preset, output `dist/`); `api/tournament.ts` becomes the only function. Connect **Upstash Redis** from the Vercel Marketplace (it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`), and set **`HOST_PIN`** for Production and Preview. After the event, set `READ_ONLY=1` to keep the results visible while refusing writes. The Node version comes from the **root** `package.json` `engines.node` (`24.x`, mirrored in `apps/pvp/package.json`). Creating the project and the database is a manual dashboard step; the runbook is [docs/pvp-deploy.md](../../docs/pvp-deploy.md).
