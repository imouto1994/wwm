# Where Winds Meet — PvP Tournament Tracker

## Product & Technical Specification

---

## 1. Overview

### 1.1 Vision

A small web app for the guild's **1v1v1 PvP tournament**. One host records each game's finishing order on a single device; everyone else follows the bracket live on a public page. It shows who is playing now, who is through, the semifinal seeding, Discord predictions and the champion. The app runs on one arena with no parallel matches, so it only ever needs to track one "now playing" series.

This is the fourth app in the `wwm` monorepo, alongside the [Boss Guide](SPEC.md), the [Reforge Pity Tracker](reforge-app.md) and the [Speedrun Loadout Randomizer](speedrun-app.md). Unlike the others it has a small backend: one Vercel Function and one Upstash Redis database holding a single JSON document.

### 1.2 Goals

| #   | Goal                                               | Success metric                                                        |
| --- | -------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Recording a game is fast enough between fights     | Two taps plus Save per game; third place fills itself in              |
| 2   | Members always see the current state               | Viewer page reflects a save within seconds (usually under 10), without reloading |
| 3   | The rules are applied the same way every time      | Qualifiers, ties and seeding are computed, never typed in by hand     |
| 4   | Mistakes and surprises are recoverable on the night | Undo, winner overrides, replacements, stage reopen, restore from history |
| 5   | Free to run                                        | Fits Vercel Hobby + Upstash free tier                                 |

### 1.3 Target audience

- The **host**: runs the event and keeps score on the host page (`/host`).
- **Guild members**: players and spectators following on the viewer page (`/`), usually on a phone next to the game or Discord.

---

## 2. Tournament rules modeled

### 2.1 Format

Every match is a 1v1v1 game in a **group of three**. A group plays a **series**: first to 2 game wins (2–4 games, since a 1-1-1 tie is possible), except the grand final, which is **first to 3** (3–7 games: all three can reach 2-2-2). The host decides the player count before the draw; the app supports **21, 24, 27 or 30** players.

| Players | Groups | Who reaches the 9-player semifinals                                   | Series (expected games\*) |
| ------- | ------ | --------------------------------------------------------------------- | ------------------------- |
| 21      | 7      | 7 group winners + **2 players the host picks** for the empty spots    | 11 (about 34)             |
| 24      | 8      | 8 group winners + **1 player the host picks** for the empty spot      | 12 (about 37)             |
| 27      | 9      | 9 group winners                                                       | 13 (about 40)             |
| 30      | 10     | 10 group winners **minus 1 the host leaves out**                      | 14 (about 43)             |

\* Assuming evenly matched players, a first-to-2 series lasts 2.89 games on average and the first-to-3 final 5.05.

The host's picks are deliberately a judgement call rather than a formula (no runner-up ranking, no play-in). At the end of the group stage the app lists the candidates by group-stage record as a guide: every non-winner for an empty spot, every winner for leaving out. Viewers see the picks as they're made.

Then:

- **Semifinals**: 3 groups of 3, first to 2. Seeded by group-stage record (§2.3), then adjustable by the host (§2.4).
- **Grand final**: the 3 semifinal winners, **first to 3**. Always first to 3, even under the late-running rule.
- **Late-running rule**: if the break before the semifinals ends late, the host can make each semifinal a **single match**. This saves about 6 games. It can only be switched before any semifinal has a result, and never applies to the final.

### 2.2 Ranking and ties

Records from each series (a player's group-stage record is their group series):

1. **Game wins**
2. **Points per game**: 1st = 3, 2nd = 1, 3rd = 0, divided by games played. Per game rather than total, so a 2-0 group and a 2-1 group compare fairly.
3. **Random draw**, run by the host from the app and recorded.

KOs are not tracked. Since the host decides who fills or leaves the semifinal spots, the only ties that need a draw are those in the **semifinal seeding**. They show up once the host's picks are complete, and **advancing is blocked until the host clicks "Draw to break the ties"**. Each draw is stored with the tie's context and players, so every screen shows the same order afterwards.

### 2.3 Semifinal seeding

The 9 semifinalists are ranked by group-stage record (wins, points per game, recorded draw), so group winners normally seed above the host's fill-ins. They go into a snake:

| Semifinal | Seeds   |
| --------- | ------- |
| 1         | 3, 4, 9 |
| 2         | 2, 5, 8 |
| 3         | 1, 6, 7 |

If two players from the same first-round group would meet again, the app swaps players **within the same seed tier** (seeds 1–3, 4–6, 7–9), using the fewest moves that remove every rematch. The result is a starting point. As soon as the seeded groups exist (group stage decided, picks made, ties drawn), **viewers see them as a draft** ("not started yet · the host may still adjust"). The host can rearrange them at the end of the group stage before pressing "Start the semifinals", and every swap shows up for viewers right away. The semifinals then start exactly as arranged.

### 2.4 Rearranging players, and when things go wrong

- **Rearrange groups**: the host can swap any two players between groups that haven't started (no game, no ruling): in the group draw (setup and group stage), in the draft semifinal groups before starting them (§2.3), and in the semifinals once started, until each has a result. Tap a player, then a player in another group. A swap clears both groups' recorded Discord predictions, since the polls were made for the old line-up. In the semifinals, the screen flags any rematch from the group stage; it's a warning, not a block.
- **Wrong result**: "Undo last game" in the current series. Results in earlier stages need "Go back a stage", which removes the current stage's series.
- **Forfeit, no-show or disconnect ruling**: "Override a series winner" with a short reason that viewers see. The override decides the series no matter what the games say.
- **A semifinalist or finalist has to leave before their series starts**: "Replace a player". Candidates are suggested best first: for the semifinals, the best group-stage records among non-semifinalists; for the final, the other two players from that finalist's semifinal. Once a series has a game, use an override instead.
- **Typo in a name**: "Fix a player's name". Results stay attached to the player's id.

### 2.5 Discord predictions

Predictions run in **EasyPoll on Discord**, not in the app. Each series can have **two polls**:

| Poll | Question (copied from the app) | Answers | Who's right |
| --- | --- | --- | --- |
| Winner | "Bảng 3: ai sẽ thắng?" / "Group 3: who wins?" | The three players | The series winner (a ruling counts) |
| Over/under games | "Bảng 3: trên hay dưới 2,5 ván?" / "Group 3: over or under 2.5 games?" | "Trên 2,5 ván" / "Dưới 2,5 ván" (or "Over/Under 2.5 games") | More or fewer games than the line |

- **The line is fixed per phase** (`GAMES_LINES` in `format.ts`), shown on every series card that hasn't finished yet:

  | Phase | Format | Line | Under / over, realistic skill\* | Under share, evenly matched → clear favourite |
  | --- | --- | --- | --- | --- |
  | Group stage | First to 2 (2–4 games) | **2.5** | 48% / 52% | 33% → 44% |
  | Semifinals | First to 2 (2–4 games) | **2.5** | 49% / 51% | 33% → 44% |
  | Grand final | First to 3 (3–7 games) | **4.5** | 47% / 53% | 33% → 53% |

  \* 200,000 simulated 27-player events with the event plan's skill model (skill drawn from a normal distribution, a player's chance in a game proportional to e^skill; semifinals and final played by the actual winners). The other columns are exact: an evenly matched first-to-2 series ends in 2, 3 or 4 games with probability 33%, 44% and 22%; a first-to-3 final in 3–7 games with 11%, 22%, 30%, 25% and 12%. "Clear favourite" means one player wins 60% of games.

  These are the half-lines closest to an even split in every scenario. The next half-line up is lopsided: 3.5 in a first-to-2 series is 78–89% under, and 5.5 in the final is 63–80% under. Whole numbers are ruled out because a game count landing on the line voids every vote: a line of 3 voids 40–44% of first-to-2 votes, and 5 voids 27–30% of final votes. A recorded poll keeps the line its voters saw.
- **No over/under** for one-match series (late-running semifinals), which always last one game. A series **decided by a ruling** voids its over/under votes, since its game count says nothing about the players.
- **Swaps and replacements** clear both polls of the affected series, because the line-up the voters saw has changed.

For each poll the host copies the question and answers from the app, posts a non-anonymous EasyPoll, and later imports the votes:

1. Get the votes as a JSON array of `{ discordId, username, vote }`, either way (see [scripts/easypoll](../scripts/easypoll)):
   - **In the browser (quickest):** on the poll's votes page in the EasyPoll dashboard, paste [`easypoll-devtools.js`](../scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console. It copies the JSON to the clipboard. If the votes span several pages, run it on each page; it merges them by Discord ID.
   - **From saved HTML:** save the votes table HTML and run `pnpm easypoll:json table.html -o votes.json`.
2. Paste or upload the JSON in the matching section of the host page's poll panel. Winner votes are matched to a player by name (emoji prefixes and case are ignored). Over/under votes are read from the first word of the answer in either language, accents ignored: "Trên"/"Over"/"Tài" is over, "Dưới"/"Under"/"Xỉu" is under. The app previews unmatched and duplicate votes, then saves the ballots.

If only counts are known, the host can type them instead (no leaderboard credit then). Predictions **never** affect the bracket. The viewer shows vote shares and the over/under line and result on each series card, how often the crowd was right on each question, and a leaderboard of members by correct predictions (winner, over/under and total).

---

## 3. Information architecture

```
PvP Tournament Tracker
├── /            Viewer page (public, read-only, polls every 4 s)
│   ├── Header: stage, live/offline status, champion banner when finished
│   ├── Now playing: current series, games so far, ETA; "on deck" next series
│   ├── Road to the semifinals (group stage only): the rule, group winners, the host's picks
│   ├── Bracket, newest stage first: grand final, semifinals, group stage (group draw preview during setup, draft semifinal groups once known)
│   ├── Discord predictions: crowd record on both questions + member leaderboard
│   └── Recent results: last games, newest first
└── /host        Host page (PIN gate, one scorekeeper device)
    ├── Setup: event name, participant list, group draw (redraw allowed, tap-to-swap players), start group stage
    ├── Run: stage gate (semifinal picks, ties, semifinal groups to arrange, late rule, advance) → game entry + poll panel → series list → "Rearrange players" (collapsed)
    ├── Finished: champion and final result
    └── Host tools (collapsed): override, replace, rename, go back a stage, restore a save, export JSON, reset
```

The path decides the page (`src/App.tsx`); there is no router library. `vercel.json` rewrites every non-API path to `index.html`.

---

## 4. Data model

One document, defined in [apps/pvp/src/types/tournament.ts](../apps/pvp/src/types/tournament.ts). It stores only inputs; everything on screen is derived from it.

```typescript
interface Tournament {
  schemaVersion: 1;
  version: number; // set by the server on every save
  updatedAt: string; // set by the server
  name: string;
  players: Player[]; // [] during setup, otherwise 21, 24, 27 or 30 ({ id: 'p1', name })
  stage: 'setup' | 'groups' | 'semis' | 'final' | 'done';
  series: Series[]; // every series created so far, in play order
  currentSeriesId?: string; // the "now playing" series
  lateRule: boolean; // semifinals are single matches
  tieDraws: TieDraw[]; // recorded random draws: { key, order, drawnAt }
  semifinalPicks?: { fillIns: PlayerId[]; dropped: PlayerId[] }; // host picks at 21/24 (fillIns) and 30 (dropped)
  semifinalDraft?: [PlayerId, PlayerId, PlayerId][]; // host's arrangement of the semifinal groups before they start; absent = seeded
}

interface Series {
  id: string; // G1..G10, S1..S3, F
  stage: 'group' | 'semi' | 'final';
  label: string; // "Group 3", "Semifinal 2", "Grand final"
  playerIds: [PlayerId, PlayerId, PlayerId];
  winsNeeded: 1 | 2 | 3; // 2 groups and semifinals, 3 the grand final, 1 late-running semifinals
  games: { placement: [first, second, third]; savedAt: string }[];
  startedAt?: string; // set by "Show as live" or the first saved game
  winnerOverride?: { playerId: PlayerId; reason: string };
  poll?: { votes: Record<PlayerId, number>; ballots?: { discordId; username; playerId }[]; recordedAt: string };
  gamesPoll?: { line: number; votes: { over; under }; ballots?: { discordId; username; pick: 'over' | 'under' }[]; recordedAt: string };
}
```

Notes:

- **Ballots are public**: the viewer API returns the whole document, including voters' Discord IDs and usernames, because the leaderboard needs them.
- A tie draw's `key` is its context plus the sorted tied ids, for example `seeding:p3,p7`. The only context in use is `seeding`.
- `semifinalPicks` is checked for shape only (known players, no repeats). Whether a pick still fits the results is derived: if an undone game turns a fill-in into a group winner, that pick simply stops counting and the host is asked to pick again.
- `parseTournament` ([validate.ts](../apps/pvp/src/lib/validate.ts)) rebuilds the document from untrusted JSON and never throws. It rejects unknown players, invalid placements, games saved after a series was decided, and unsupported player counts.

---

## 5. Core logic

Framework-free functions in [apps/pvp/src/lib](../apps/pvp/src/lib). They use relative `.js` imports because the Vercel Function runs them as plain Node ESM.

| Module             | Responsibility                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `format.ts`        | Supported counts; groups, empty semifinal spots (`fillInSpots`) and extra winners (`dropSpots`) per count |
| `series.ts`        | Per-series records (wins, points, games), winner (override first), placement validation                  |
| `ranking.ts`       | `compareRecords`, `rankRecords` with recorded draws, tie keys                                            |
| `qualification.ts` | Group winners and records (works on partial results), `semifinalSelection` (pick candidates, valid picks, semifinalists), seeding order, pending seeding ties |
| `seeding.ts`       | Snake seeding with fewest-move rematch avoidance inside seed tiers                                       |
| `draw.ts`          | Fisher–Yates shuffle, random group draw                                                                  |
| `reducer.ts`       | Every host action and stage transition; replacement candidates                                           |
| `validate.ts`      | `parseTournament` for untrusted input                                                                    |
| `polls.ts`         | EasyPoll JSON parsing and matching (players by name, over/under by keyword), vote shares, over/under outcome (over, under, push, void), crowd records, prediction leaderboard |
| `i18n.ts`          | The English and Vietnamese message mappings, `Translatable`, and locale-aware number, time and "ago" formatting |
| `eta.ts`           | Average minutes per game from save timestamps (gaps over 15 min ignored, at least 3 samples) and expected games left |

### 5.1 Host actions

All changes go through `applyAction(tournament, action, { now, random }) → Result<Tournament>`. It returns an error message instead of throwing, and the host page shows that message.

| Action                                        | Allowed when                                                    |
| --------------------------------------------- | --------------------------------------------------------------- |
| `setName`                                     | Any time                                                        |
| `setPlayers`, `drawGroups`, `startGroupStage` | Setup (players must be 21/24/27/30 unique names, max 32 chars)  |
| `startSeries`, `saveGame`, `undoGame`         | Series in the current stage, not yet decided (undo: has a game) |
| `overrideWinner`, `clearOverride`             | Series in the current stage; reason required                    |
| `replacePlayer`                               | Semifinal or final series with no games or override yet         |
| `swapPlayers`                                 | Setup, group stage or semifinals; two players in different series, neither of which has a game or override (clears both series' polls) |
| `setSemifinalPicks`                           | Group stage, every group decided; fill-ins must be non-winners, dropped players must be winners, at most the number of spots (partial picks allowed). Clears any semifinal arrangement |
| `arrangeSemifinals`, `resetSemifinalDraft`    | Group stage, once the semifinal groups exist (picks made, ties drawn): swap two players between draft groups, or go back to the seeded groups |
| `recordPoll`, `clearPoll`                     | Any series                                                      |
| `recordGamesPoll`, `clearGamesPoll`           | Any series that isn't a single match; the phase's fixed line is copied into the recorded poll |
| `resolveTies`                                 | There are pending ties (repeats while new ties surface)         |
| `setLateRule`                                 | Before any semifinal has a result                               |
| `advance`                                     | Every series in the stage decided, semifinal picks complete (group stage), no pending ties |
| `reopenStage`                                 | After setup; groups → setup only while no group has results     |
| `reset`                                       | Any time (earlier saves stay restorable)                        |

`advance` creates the next stage's series: the semifinals (`S1`–`S3`) exactly as arranged (or seeded), first to 2 or one match under the late rule; then the grand final (`F`, first to 3); then `done`. A draft that no longer holds exactly the current semifinalists (say, after new picks) is ignored and the seeded groups are used. Going back from the semifinals keeps the host's picks and turns the semifinal groups back into the draft, so nothing has to be redone. A new participant list or a redraw clears both.

The host page uses `crypto.getRandomValues` for draws, so no one can claim the draw was rigged.

---

## 6. UI / UX

### 6.1 Viewer page

- **Now playing**: the live series with each player's game placements and win pips, plus "next series in about N minutes" once there's enough timing data. When nothing is live: "Waiting for the host to start the next series" and the next series "on deck".
- **Road to the semifinals** (group stage): the qualification rule in plain words for the player count, the group winners (a winner the host left out is struck through), and the host's picks.
- **Series cards**: per-game place chips, win pips, crown for the winner, "Live / Finished / Upcoming", the series length ("first to 2", "first to 3" or "one match"), vote shares when a poll was recorded, the over/under line with its vote split and, once finished, the result ("3 ván: Trên"), and the reason for any override.
- **Discord predictions** and **recent results** (newest first; identical timestamps fall back to play order).
- Status shows "Live · updated just now" or "Offline", and the last good state stays on screen while offline.

### 6.2 Host page

- **PIN gate**: the PIN is kept in `sessionStorage` for the tab and sent as the `x-host-pin` header. A wrong PIN, or a PIN changed on the server, sends the host back to the gate.
- **Setup**: paste names one per line, save, draw groups (redraw any time before starting), adjust the draw by tapping two players in different groups to swap them, then start the group stage.
- **Rearrange players** (group stage and semifinals, collapsed under the series list): the same tap-to-swap for groups that haven't started; started groups are shown locked. In the semifinals each name shows its first-round group, and rematches are flagged.
- **Game entry**: tap the winner, then the runner-up; third place fills itself in. Save, Undo last game, and "Show as live" to mark a series as playing before its first result. Picks clear as soon as a game is saved, so a double tap can't save it twice.
- **Poll panel**: two sections, "who wins?" and (except single matches) "over/under games" with the phase's fixed line. Each has copy-ready question and answers, a votes JSON import with preview, typed counts, and a clear button.
- **Stage gate** (once every series in the stage is decided): who's through; at 21, 24 or 30 players, the semifinal picker (candidates with group and record; it folds to a one-line summary with "Change" once complete); pending seeding ties and the draw button, recent draws, the semifinal groups as viewers see them with tap-to-swap (and "Back to the seeded groups" after any swap), late-running rule checkbox, and the advance button ("Start the semifinals", "Start the grand final", "Finish the tournament").
- **Save indicator**: "Saving…", "All changes saved", or "Not saved" with a retry button.
- **Host tools**: see §2.4, plus "Restore an earlier save" (last 50 saves), "Download JSON" (backup after each stage), and "Reset" (type RESET to confirm). Destructive tools ask for confirmation.

### 6.3 Languages

The app speaks **Vietnamese (default) and English**, switched with the VI / EN toggle in the header of both pages (and on the PIN screen). The choice is remembered in `localStorage` per browser and sets `<html lang>` and the page title.

- All text lives in one mapping, [apps/pvp/src/lib/i18n.ts](../apps/pvp/src/lib/i18n.ts): English defines the shape and Vietnamese must match it key for key, so a missing translation fails the typecheck.
- Errors from the rules (`applyAction`), the votes JSON parser and the API come back as functions of the messages, so they render in whichever language is selected, even after switching.
- Series names ("Bảng 3", "Bán kết 2", "Chung kết") are derived from the series id and stage. The English `label` stored in the document is kept only for older data.
- Numbers follow the locale: "1,33 điểm/ván", "Trên 2,5 ván" in Vietnamese; "1.33 pts/game", "Over 2.5 games" in English. Times use the 24-hour clock in both.
- Poll questions copy in the selected language. The importer reads over/under answers in either language, so a poll posted in one language and imported in the other still works.

### 6.4 Theme

The shared wuxia palette from the other apps ([apps/pvp/src/index.css](../apps/pvp/src/index.css)): `bg #0f0f0f`, `surface #1a1a2e`, `fg #e8e6e3`, `gold #c9a84c`, `border #2a2a3e`, plus `green #5fae7b` for "through" and "live". Mobile-first.

---

## 7. Technical architecture

### 7.1 Stack

| Layer           | Technology                                          |
| --------------- | --------------------------------------------------- |
| Build tool      | Vite 8                                              |
| UI              | React 18 + TypeScript 5                             |
| Styling         | Tailwind CSS 4 (`@tailwindcss/vite`)                |
| Icons           | lucide-react                                        |
| API             | One Vercel Function (Web `Request` → `Response`)    |
| Storage         | Upstash Redis (`@upstash/redis`, REST)              |
| Lint/format     | Biome (shared root config)                          |
| Testing         | None by choice; verified end to end on the dev server |
| Package manager | pnpm (workspace)                                    |

### 7.2 Structure

```
apps/pvp/
├── api/tournament.ts        # the Vercel Function: GET + PUT → server/handler.ts
├── server/
│   ├── handler.ts           # routes, validation, status codes, cache headers
│   ├── store.ts             # Redis store (Lua compare-and-set, capped history) + in-memory store
│   ├── auth.ts              # host PIN check (sha256 + timingSafeEqual, fails closed)
│   └── dev.ts               # Vite dev middleware entry (memory store, PIN "dev")
├── src/
│   ├── App.tsx              # /host → HostApp, anything else → ViewerApp
│   ├── types/tournament.ts
│   ├── lib/                 # pure rules (see §5) + i18n, apiClient, names
│   ├── hooks/               # useTournamentFeed, useHostTournament, useHostPin, useNow
│   ├── components/          # shared cards + viewer/* + host/*
│   └── views/               # ViewerApp, HostApp
├── vite.config.ts           # React + Tailwind, '@' alias, port 2140, dev API middleware
├── vercel.json              # SPA rewrite for non-API paths
└── AGENTS.md
```

### 7.3 API

`/api/tournament` is the only endpoint.

| Request                                    | Who  | Response                                                                                           |
| ------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| `GET`                                      | Anyone | `{ tournament }` (`null` before the first save). CDN-cached: `Vercel-CDN-Cache-Control: s-maxage=2, stale-while-revalidate=5` |
| `GET ?fresh=1`                             | Host | `{ tournament }`, never cached (host page load)                                                    |
| `GET ?history=1`                           | Host | `{ history }`, the last 50 saves, newest first                                                     |
| `PUT { expectedVersion, tournament }`      | Host | `200 { tournament }` with `version = expectedVersion + 1`; `409 { error, tournament }` with the current state if the version moved on |

Other statuses: `400` invalid JSON or document, `401` wrong or missing PIN, `403` read-only mode, `413` body over 256 KB, `405` other methods, `503` storage not configured, `500` storage unreachable (logged with the method and error message only).

### 7.4 Saving and conflicts

- The host page applies each action locally first, then PUTs the **whole document** with the version it was based on. Saves are serialized: changes made during a save are sent right after it, against the new version.
- Redis holds `pvp:<env>:state`, `pvp:<env>:version` and `pvp:<env>:history` (capped list of 50). A Lua script compares the version and writes all three atomically, so a stale tab can never overwrite newer results.
- On `409` the host page loads the newer state and asks the host to redo the last change. On network errors it keeps the local state and shows "Not saved" with a retry.
- Viewers poll every 4 seconds while the tab is visible. With the 2-second CDN cache, a busy viewer page costs Redis about one read every 2 seconds per CDN region, however many people are watching.

### 7.5 Security

- Writes and host reads need the `HOST_PIN` value in the `x-host-pin` header, compared in constant time on sha256 digests. Without `HOST_PIN` nobody can write.
- `READ_ONLY=1` keeps the results public after the event while refusing every write.
- The server validates every document and stamps `version` / `updatedAt` itself.
- No logging of the PIN, request bodies or ballots.

### 7.6 Local development

`pnpm dev:pvp` serves the app at http://localhost:2140 and `/api/tournament` through a Vite middleware that runs the same `server/handler.ts`. Without configuration it uses an in-memory store (kept across server-code reloads, lost on restart) and host PIN `dev`. To test against real Redis or a real PIN, put `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*` names) and `HOST_PIN` in `apps/pvp/.env.local`; keys then use the `pvp:development` prefix. `.env*.local` files are gitignored.

---

## 8. Deployment

| Setting          | Value                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| Root Directory   | `apps/pvp`                                                                              |
| Framework preset | Vite (auto-detected); `api/` is picked up as Vercel Functions                           |
| Build command    | `vite build` (via `pnpm build`)                                                         |
| Output directory | `dist`                                                                                  |
| Install          | pnpm workspace install at repo root (keep "Include files outside the root directory" enabled) |
| Node version     | root `package.json` `engines.node` = `24.x` (mirrored in `apps/pvp/package.json`)      |

The full step-by-step runbook, with verification, a rehearsal, event-day operations and recovery recipes, is [pvp-deploy.md](pvp-deploy.md). In short, one-time setup (manual, in the Vercel dashboard):

1. Create a project from this repo with Root Directory `apps/pvp`.
2. **Storage → Marketplace → Upstash Redis**, free plan, connected to the project. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` for every environment.
3. Set **`HOST_PIN`** for Production and Preview. Share it only with the host.
4. Deploy. Rehearse on a preview deployment if you like: preview data lives under `pvp:preview:*`, separate from production's `pvp:production:*`.
5. After the event, optionally set `READ_ONLY=1` and redeploy.

---

## 9. Event-day checklist

1. Before the event: open `/host`, enter the PIN, set the event name and paste the final participant list.
2. Draw the groups (redraw if needed, or swap individual players) and share the viewer link in Discord. The draw shows on the viewer page right away.
3. For each series: "Show as live", post the two EasyPolls (winner and over/under) from the copied questions and answers, and record each game with two taps. When a poll closes, run the console snippet on its EasyPoll votes page and paste the copied JSON into the matching section of the poll panel.
4. At the end of the group stage: at 21 or 24 players pick who fills the empty semifinal spots, at 30 pick the winner to leave out. Then break any seeding ties with the draw button. The semifinal groups now appear for viewers: rearrange them if needed, decide on the late-running rule, and start the semifinals. Then post the semifinal polls from each series' poll panel.
5. Download the JSON backup after each stage.

---

## 10. Implementation phases

### Phase 1 — MVP (implemented)

- [x] `apps/pvp` scaffold (Vite + React + TS + Tailwind 4, port 2140), root scripts `dev:pvp` / `build:pvp`
- [x] Pure rules: format, series records, ranking with recorded draws, qualification, snake seeding, reducer, validation, ETA, polls
- [x] API + storage: one Vercel Function, Upstash Redis with compare-and-set and capped history, PIN auth, dev middleware
- [x] Host page: PIN gate, setup and draw, two-tap entry, polls import, stage gate, host tools
- [x] Host control over line-ups: tap-to-swap players in the group draw and the semifinals; host picks for empty semifinal spots (21, 24) or the winner left out (30), replacing the runner-up and play-in rules
- [x] Second prediction per series: over/under games with a fixed line per phase (2.5, 2.5, 4.5), in the poll panel, series cards and leaderboard
- [x] First-to-3 grand final
- [x] Vietnamese (default) and English, from one translation mapping, with a VI / EN switch
- [x] Viewer page: now playing, road to the semifinals, bracket, predictions, recent results
- [x] EasyPoll dashboard table → votes JSON: DevTools console snippet and `pnpm easypoll:json`

### Phase 2 — Possible later

- [ ] Player counts that aren't multiples of 3 (byes or pairs)
- [ ] A second scorekeeper device

---

## 11. Out of scope

- **KOs or damage stats**: dropped from the rules on purpose.
- **In-app voting**: predictions stay in EasyPoll on Discord.
- **Parallel arenas**: the event uses one arena, so there is one "now playing" series.
- **Accounts or multiple events**: one PIN, one tournament document per environment.
- **Realtime push**: polling through the CDN is enough for this audience.

---

## 12. Legal / Copyright

_Where Winds Meet_ is developed by Everstone Studios. This is an **unofficial fan tool**, not affiliated with or endorsed by Everstone Studios.
