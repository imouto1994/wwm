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

Every match is a 1v1v1 game in a **group of three**. A group plays a **series**: first to 2 game wins (at most 4 games, since a 1-1-1 tie is possible). The host decides the player count before the draw; the app supports **21, 24, 27 or 30** players.

| Players | Groups | Who reaches the 9-player semifinals                                                                   | Series (expected games\*) |
| ------- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------- |
| 21      | 7      | 7 group winners + the 2 best runners-up                                                                | 11 (about 32)             |
| 24      | 8      | 8 group winners + the best runner-up                                                                   | 12 (about 35)             |
| 27      | 9      | 9 group winners                                                                                        | 13 (about 38)             |
| 30      | 10     | 8 strongest group winners; a **play-in** (one match) between the 2 weakest winners and the best runner-up decides the last spot | 15 (about 41)             |

\* Assuming evenly matched players, a first-to-2 series lasts 2.89 games on average.

Then:

- **Semifinals**: 3 groups of 3, first to 2. Seeded by group-stage record (§2.3).
- **Grand final**: the 3 semifinal winners, first to 2. Always first to 2.
- **Late-running rule**: if the break before the semifinals ends late, the host can make each semifinal a **single match**. This saves about 6 games. It can only be switched before any semifinal has a result, and never applies to the final.

### 2.2 Ranking and ties

Records from each series (a player's group-stage record is their group series):

1. **Game wins**
2. **Points per game**: 1st = 3, 2nd = 1, 3rd = 0, divided by games played. Per game rather than total, so a 2-0 group and a 2-1 group compare fairly.
3. **Random draw**, run by the host from the app and recorded.

KOs are not tracked. A tie is only drawn when it changes something:

- who is a group's runner-up (21, 24 and 30 players),
- who gets the runner-up spots or the play-in spot, or who goes straight through at 30 players,
- any position in the semifinal seeding.

Ties among players who all miss out stay unresolved. The app shows pending ties at the end of a stage, and **advancing is blocked until the host clicks "Draw to break the ties"**. Each draw is stored with the tie's context and players, so every screen shows the same order afterwards.

### 2.3 Semifinal seeding

The 9 semifinalists are ranked by group-stage record (wins, points per game, recorded draw), so group winners always seed above runners-up. They go into a snake:

| Semifinal | Seeds   |
| --------- | ------- |
| 1         | 3, 4, 9 |
| 2         | 2, 5, 8 |
| 3         | 1, 6, 7 |

If two players from the same first-round group would meet again, the app swaps players **within the same seed tier** (seeds 1–3, 4–6, 7–9), using the fewest moves that remove every rematch. The play-in winner at 30 players takes their seed from their group-stage record like everyone else.

### 2.4 When things go wrong

- **Wrong result**: "Undo last game" in the current series. Results in earlier stages need "Go back a stage", which removes the current stage's series.
- **Forfeit, no-show or disconnect ruling**: "Override a series winner" with a short reason that viewers see. The override decides the series no matter what the games say.
- **A semifinalist or finalist has to leave before their series starts**: "Replace a player". Candidates are suggested best first: for the semifinals, the best group-stage records among non-semifinalists; for the final, the other two players from that finalist's semifinal. Once a series has a game, use an override instead.
- **Typo in a name**: "Fix a player's name". Results stay attached to the player's id.

### 2.5 Discord predictions

Predictions run in **EasyPoll on Discord**, not in the app. For each series the host copies the poll question ("Group 3: who wins?") and the three answers from the app, posts a non-anonymous poll, and later imports the votes:

1. Get the votes as a JSON array of `{ discordId, username, vote }`, either way (see [scripts/easypoll](../scripts/easypoll)):
   - **In the browser (quickest):** on the poll's votes page in the EasyPoll dashboard, paste [`easypoll-devtools.js`](../scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console. It copies the JSON to the clipboard. If the votes span several pages, run it on each page; it merges them by Discord ID.
   - **From saved HTML:** save the votes table HTML and run `pnpm easypoll:json table.html -o votes.json`.
2. Paste or upload the JSON in the host page's poll panel. The app matches each vote to a player by name (emoji prefixes and case are ignored), previews unmatched and duplicate votes, then saves the ballots.

If only counts are known, the host can type them instead (no leaderboard credit then). Predictions **never** affect the bracket. The viewer shows vote shares on each series card, how often the crowd favourite won, and a leaderboard of members by correct predictions.

---

## 3. Information architecture

```
PvP Tournament Tracker
├── /            Viewer page (public, read-only, polls every 4 s)
│   ├── Header: stage, live/offline status, champion banner when finished
│   ├── Now playing: current series, games so far, ETA; "on deck" next series
│   ├── Road to the semifinals (group stage and play-in only): winners, runners-up race, play-in line-up
│   ├── Bracket, newest stage first: grand final, semifinals, play-in, group stage (group draw preview during setup)
│   ├── Discord predictions: crowd-favourite record + member leaderboard
│   └── Recent results: last games, newest first
└── /host        Host page (PIN gate, one scorekeeper device)
    ├── Setup: event name, participant list, group draw (redraw allowed), start group stage
    ├── Run: stage gate (ties, semifinal preview, late rule, advance) → game entry + poll panel → series list
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
  stage: 'setup' | 'groups' | 'playIn' | 'semis' | 'final' | 'done';
  series: Series[]; // every series created so far, in play order
  currentSeriesId?: string; // the "now playing" series
  lateRule: boolean; // semifinals are single matches
  tieDraws: TieDraw[]; // recorded random draws: { key, order, drawnAt }
}

interface Series {
  id: string; // G1..G10, PI, S1..S3, F
  stage: 'group' | 'playIn' | 'semi' | 'final';
  label: string; // "Group 3", "Play-in", "Semifinal 2", "Grand final"
  playerIds: [PlayerId, PlayerId, PlayerId];
  winsNeeded: 1 | 2;
  games: { placement: [first, second, third]; savedAt: string }[];
  startedAt?: string; // set by "Show as live" or the first saved game
  winnerOverride?: { playerId: PlayerId; reason: string };
  poll?: { votes: Record<PlayerId, number>; ballots?: { discordId; username; playerId }[]; recordedAt: string };
}
```

Notes:

- **Ballots are public**: the viewer API returns the whole document, including voters' Discord IDs and usernames, because the leaderboard needs them.
- A tie draw's `key` is its context plus the sorted tied ids, for example `seeding:p3,p7`. Contexts: `runnerUp:<groupId>`, `runnersUp`, `winners`, `seeding`.
- `parseTournament` ([validate.ts](../apps/pvp/src/lib/validate.ts)) rebuilds the document from untrusted JSON and never throws. It rejects unknown players, invalid placements, games saved after a series was decided, and unsupported player counts.

---

## 5. Core logic

Framework-free functions in [apps/pvp/src/lib](../apps/pvp/src/lib). They use relative `.js` imports because the Vercel Function runs them as plain Node ESM.

| Module             | Responsibility                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `format.ts`        | Supported counts; groups, runner-up spots and play-in per count                                          |
| `series.ts`        | Per-series records (wins, points, games), winner (override first), placement validation                  |
| `ranking.ts`       | `compareRecords`, `rankRecords` with recorded draws, tie keys, ties across a cut                         |
| `qualification.ts` | Group-stage outcome (works on partial results for the viewer), semifinalists, seeding order, pending ties |
| `seeding.ts`       | Snake seeding with fewest-move rematch avoidance inside seed tiers                                       |
| `draw.ts`          | Fisher–Yates shuffle, random group draw                                                                  |
| `reducer.ts`       | Every host action and stage transition; replacement candidates                                           |
| `validate.ts`      | `parseTournament` for untrusted input                                                                    |
| `polls.ts`         | EasyPoll JSON matching, vote shares, crowd favourite, prediction leaderboard, poll prompt               |
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
| `recordPoll`, `clearPoll`                     | Any series                                                      |
| `resolveTies`                                 | There are pending ties (repeats while new ties surface)         |
| `setLateRule`                                 | Before any semifinal has a result                               |
| `advance`                                     | Every series in the stage decided and no pending ties           |
| `reopenStage`                                 | After setup; groups → setup only while no group has results     |
| `reset`                                       | Any time (earlier saves stay restorable)                        |

`advance` creates the next stage's series: the play-in (`PI`, one match) at 30 players, the seeded semifinals (`S1`–`S3`, first to 2 or one match under the late rule), then the grand final (`F`, first to 2), then `done`.

The host page uses `crypto.getRandomValues` for draws, so no one can claim the draw was rigged.

---

## 6. UI / UX

### 6.1 Viewer page

- **Now playing**: the live series with each player's game placements and win pips, plus "next series in about N minutes" once there's enough timing data. When nothing is live: "Waiting for the host to start the next series" and the next series "on deck".
- **Road to the semifinals** (group stage and play-in): the qualification rule in plain words, group winners (gold if they're heading to the play-in), the runners-up race with records, and the play-in line-up.
- **Series cards**: per-game place chips, win pips, crown for the winner, "Live / Finished / Upcoming", the series length ("first to 2" or "one match"), vote shares when a poll was recorded, and the reason for any override.
- **Discord predictions** and **recent results** (newest first; identical timestamps fall back to play order).
- Status shows "Live · updated just now" or "Offline", and the last good state stays on screen while offline.

### 6.2 Host page

- **PIN gate**: the PIN is kept in `sessionStorage` for the tab and sent as the `x-host-pin` header. A wrong PIN, or a PIN changed on the server, sends the host back to the gate.
- **Setup**: paste names one per line, save, draw groups (redraw any time before starting), start the group stage.
- **Game entry**: tap the winner, then the runner-up; third place fills itself in. Save, Undo last game, and "Show as live" to mark a series as playing before its first result. Picks clear as soon as a game is saved, so a double tap can't save it twice.
- **Poll panel**: copy question / answers, import votes JSON (with preview), or type counts.
- **Stage gate** (once every series in the stage is decided): who's through, pending ties and the draw button, recent draws, semifinal preview, late-running rule checkbox, and the advance button ("Start the play-in", "Seed and start the semifinals", "Start the grand final", "Finish the tournament").
- **Save indicator**: "Saving…", "All changes saved", or "Not saved" with a retry button.
- **Host tools**: see §2.4, plus "Restore an earlier save" (last 50 saves), "Download JSON" (backup after each stage), and "Reset" (type RESET to confirm). Destructive tools ask for confirmation.

### 6.3 Theme

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
│   ├── lib/                 # pure rules (see §5) + apiClient, names, time
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

One-time setup (manual, in the Vercel dashboard):

1. Create a project from this repo with Root Directory `apps/pvp`.
2. **Storage → Marketplace → Upstash Redis**, free plan, connected to the project. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` for every environment.
3. Set **`HOST_PIN`** for Production and Preview. Share it only with the host.
4. Deploy. Rehearse on a preview deployment if you like: preview data lives under `pvp:preview:*`, separate from production's `pvp:production:*`.
5. After the event, optionally set `READ_ONLY=1` and redeploy.

---

## 9. Event-day checklist

1. Before the event: open `/host`, enter the PIN, set the event name and paste the final participant list.
2. Draw the groups (redraw if needed) and share the viewer link in Discord. The draw shows on the viewer page right away.
3. For each series: "Show as live", post the EasyPoll from the copied question and answers, record each game with two taps. When the poll closes, run the console snippet on its EasyPoll votes page and paste the copied JSON into the poll panel.
4. At the end of a stage: break any ties with the draw button, check the semifinal preview, decide on the late-running rule, then advance.
5. Download the JSON backup after each stage.

---

## 10. Implementation phases

### Phase 1 — MVP (implemented)

- [x] `apps/pvp` scaffold (Vite + React + TS + Tailwind 4, port 2140), root scripts `dev:pvp` / `build:pvp`
- [x] Pure rules: format, series records, ranking with recorded draws, qualification, play-in, snake seeding, reducer, validation, ETA, polls
- [x] API + storage: one Vercel Function, Upstash Redis with compare-and-set and capped history, PIN auth, dev middleware
- [x] Host page: PIN gate, setup and draw, two-tap entry, polls import, stage gate, host tools
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
