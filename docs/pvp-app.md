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
| 30      | 10     | 10 group winners **minus 1 knocked out in a survival game**           | 15 (about 44)             |

\* Assuming evenly matched players, a first-to-2 series lasts 2.89 games on average and the first-to-3 final 5.05.

At 21 and 24 players the host's picks are deliberately a judgement call rather than a formula (no runner-up ranking, no play-in). At the end of the group stage the app lists every non-winner by group-stage record as a guide, and viewers see the picks as they're made.

**The survival game ("Trận sinh tử", 30 players only).** There's one group winner too many, and a rule decides who goes out, not the host:

1. Rank the 10 group winners by **fewest game wins**, then **lowest points per game** (§2.2). Normal winners all have 2 game wins, so wins only matter when a ruling decided a group.
2. The **3 weakest** take the seats. If the last seat or seats fall inside a group of winners with the same record, a **recorded draw** picks who takes them, and the rest of that group is safe. That includes 4 or more winners tied for the lowest record. Ties wholly inside or outside the seats need no draw.
3. The three play **one 1v1v1 game**. 1st and 2nd go through to the semifinals, and **3rd place is out**.

Why it works this way: winners' records come in only six shapes (3.00, 2.33, 2.00, 1.75 or 1.50 points per game), so a pure "lowest record is out" rule would leave a coin flip to knock out a group winner in about 44% of events. With the survival game, luck only decides who is at risk, and the game decides who leaves. With 10 evenly matched winners, the three weakest are clear 34% of the time; in the other 66% a draw fills the last seat or seats, and in 9% four or more share the lowest record.

The survival game is its own short stage between the group stage and the semifinals, with its own Discord poll (§2.5). It takes no winner rulings: if a player can't play, the host saves the game with them in 3rd place. The player it knocks out is still the first candidate if a semifinalist has to be replaced (§2.4).

Then:

- **Semifinals**: 3 groups of 3, first to 2. Seeded by group-stage record (§2.3), then adjustable by the host (§2.4).
- **Grand final**: the 3 semifinal winners, **first to 3**.
- Semifinals are always first to 2. An earlier "late-running rule" that could cut them to one game each was removed by the owner's choice.

### 2.2 Ranking and ties

Records from each series (a player's group-stage record is their group series):

1. **Game wins**
2. **Points per game**: 1st = 3, 2nd = 1, 3rd = 0, divided by games played. Per game rather than total, so a 2-0 group and a 2-1 group compare fairly.
3. **Random draw**, run by the host from the app and recorded.

KOs are not tracked. Two kinds of ties need a draw: the **last survival seat** at 30 players (§2.1), once every group is decided, and the **semifinal seeding**, once the host's picks or the survival game are done. **Advancing is blocked until the host clicks "Draw to break the ties"**. Each draw is stored with the tie's context and players, so every screen shows the same order afterwards.

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
- **A player can't play, before their series starts**: "Replace a player" (Host tools). The series' recorded predictions are cleared, since they were for the old line-up.
  - **In a group** (during setup after the draw, or the group stage): pick a **reserve** from the display names who isn't in the event (add them there first). The reserve takes the player's place in the event and the rest of the draw stays, so a no-show found after the public draw doesn't force a redraw.
  - **In the semifinals or the final**: candidates are suggested best first. For the semifinals, the best group-stage records among non-semifinalists (at 30 players, normally the player the survival game knocked out); for the final, the other two players from that finalist's semifinal.
  - Once a series has a game, use an override instead, or record the absent player in 3rd. The survival game takes neither a replacement nor an override: save its game with the absent player in 3rd.
- **Typo in a name, or a voter missing from the leaderboard names**: edit the display names (Host tools → Display names, §2.6). Results and ballots stay attached to the username.

### 2.5 Discord predictions

Predictions run in **EasyPoll on Discord**, not in the app. Each series can have **two polls**:

| Poll | Question (copied from the app) | Answers | Who's right |
| --- | --- | --- | --- |
| Winner | "Bảng 3: ai sẽ thắng?" / "Group 3: who wins?" | The three players | The series winner (a ruling counts) |
| Who goes out (survival game only, instead of the winner poll) | "Trận sinh tử: ai về Ba và bị loại?" / "Survival game: who finishes 3rd and goes out?" | The three players | The player who finishes 3rd; counts in the leaderboard's winner column |
| Over/under games | "Bảng 3: trên hay dưới 2,5 ván?" / "Group 3: over or under 2.5 games?" | "Trên 2,5 ván" / "Dưới 2,5 ván" (or "Over/Under 2.5 games") | More or fewer games than the line |

- **The line is fixed per phase** (`GAMES_LINES` in `format.ts`), shown on every series card that hasn't finished yet:

  | Phase | Format | Line | Under / over, realistic skill\* | Under share, evenly matched → clear favourite |
  | --- | --- | --- | --- | --- |
  | Group stage | First to 2 (2–4 games) | **2.5** | 48% / 52% | 33% → 44% |
  | Semifinals | First to 2 (2–4 games) | **2.5** | 49% / 51% | 33% → 44% |
  | Grand final | First to 3 (3–7 games) | **4.5** | 47% / 53% | 33% → 53% |

  \* 200,000 simulated 27-player events with the event plan's skill model (skill drawn from a normal distribution, a player's chance in a game proportional to e^skill; semifinals and final played by the actual winners). The other columns are exact: an evenly matched first-to-2 series ends in 2, 3 or 4 games with probability 33%, 44% and 22%; a first-to-3 final in 3–7 games with 11%, 22%, 30%, 25% and 12%. "Clear favourite" means one player wins 60% of games.

  These are the half-lines closest to an even split in every scenario. The next half-line up is lopsided: 3.5 in a first-to-2 series is 78–89% under, and 5.5 in the final is 63–80% under. Whole numbers are ruled out because a game count landing on the line voids every vote: a line of 3 voids 40–44% of first-to-2 votes, and 5 voids 27–30% of final votes. A recorded poll keeps the line its voters saw.
- **No over/under** for the survival game, which is always one game. A series **decided by a ruling** voids its over/under votes, since its game count says nothing about the players.
- **Swaps and replacements** clear both polls of the affected series, because the line-up the voters saw has changed.

For each poll the host copies the question and answers from the app, posts a non-anonymous EasyPoll, and later imports the votes:

1. Get the votes as a JSON array of `{ username, vote }`, either way (see [scripts/easypoll](../scripts/easypoll)):
   - **In the browser (quickest):** on the poll's votes page in the EasyPoll dashboard, paste [`easypoll-devtools.js`](../scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console. It copies the JSON to the clipboard. If the votes span several pages, run it on each page; it merges them by username.
   - **From saved HTML:** save the votes table HTML and run `pnpm easypoll:json table.html -o votes.json`.
2. Paste or upload the JSON in the matching section of the host page's poll panel. Winner answers are the players' display names, so each vote is read back to that player's username through the display names (emoji prefixes and case are ignored; a name of someone outside the series doesn't match). Voters are matched by username, ignoring case and a leading "@"; an older export that still carries `discordId` imports fine, the ID is ignored. Over/under votes are read from the first word of the answer in either language, accents ignored: "Trên"/"Over"/"Tài" is over, "Dưới"/"Under"/"Xỉu" is under. The app previews unmatched and duplicate votes, then saves the ballots.

**The votes JSON is the only way to record a poll.** There's no typed-counts fallback, so every recorded vote names its voter and the predictor leaderboard stays complete throughout the event. Vote counts and shares are derived from the ballots. Predictions **never** affect the bracket. The viewer shows vote shares and the over/under line and result on each series card, how often the crowd was right on each question, and a leaderboard of members by correct predictions (winner, over/under and total) that updates as each series finishes.

### 2.6 Discord usernames and display names

Everyone is identified by **Discord username** (the unique `@handle`, which is what EasyPoll's votes table shows): participants are entered as usernames, and the votes JSON names each voter by username. What people see is a **display name** from one list the host pastes as JSON:

```json
{ "lan.wwm": "Lan", "minh_99": "Minh" }
```

- Usernames are stored lowercase without "@", so `@Lan.WWM` and `lan.wwm` are the same person everywhere (list, participants, votes). They must follow Discord's rules: 2–32 characters of a–z, 0–9, `_` and `.`, never two dots in a row.
- The list covers participants **and** predictors; voters don't have to play, so it can hold far more people than the tournament (up to 1,000).
- Every participant needs an entry before the participant list can be saved, and the list can't drop a participant later.
- Display names are 1–32 characters and unique, ignoring case and leading emoji, the same comparison the winner-poll importer uses. That makes "display name → username" one-to-one, which is how winner answers are read.
- Saving replaces the whole list. Editing it (in setup, or later under Host tools) renames people everywhere at once, including the leaderboard; results and ballots stay attached to the username.
- A voter missing from the list shows on the leaderboard under their username.
- Reset keeps the list, since it's guild data rather than event results.
- Numeric Discord IDs aren't used or stored. A member who changes their Discord username mid-event shows up as a new voter; update the list if that happens.

---

## 3. Information architecture

```
PvP Tournament Tracker
├── /            Viewer page (public, read-only, polls every 4 s)
│   ├── Header: stage, live/offline status, champion banner when finished
│   ├── Now playing: current series, games so far, ETA; "on deck" next series
│   ├── Road to the semifinals (group stage, and the survival game at 30 players): the rule, group winners, the host's picks or the survival seats
│   ├── Bracket, newest stage first: grand final, semifinals, survival game (30 players), group stage (drafts shown as soon as line-ups are known)
│   ├── Bảng Thần Toán (prediction leaderboard): sticky side column on wide screens, bottom dock + sheet on phones
│   └── Recent results: last games, newest first
└── /host        Host page (PIN gate, one scorekeeper device)
    ├── Setup: event name, display names (JSON), participants by Discord username, group draw (redraw allowed, tap-to-swap players), start group stage
    ├── Run: stage gate (semifinal picks or survival seats, ties, semifinal groups to arrange, advance) → game entry + poll panel → series list → "Rearrange players" (collapsed)
    ├── Finished: champion and final result
    └── Host tools (collapsed): override, replace, display names, go back a stage, restore a save, export JSON, reset
```

The path decides the page (`src/App.tsx`); there is no router library. `vercel.json` rewrites every non-API path to `index.html`.

---

## 4. Data model

One document, defined in [apps/pvp/src/types/tournament.ts](../apps/pvp/src/types/tournament.ts). It stores only inputs; everything on screen is derived from it.

```typescript
interface Tournament {
  schemaVersion: 2;
  version: number; // set by the server on every save
  updatedAt: string; // set by the server
  name: string;
  players: PlayerId[]; // Discord usernames (lowercase, no "@"); [] during setup, otherwise 21, 24, 27 or 30
  displayNames: Record<string, string>; // username → display name, participants and predictors (§2.6)
  stage: 'setup' | 'groups' | 'survival' | 'semis' | 'final' | 'done'; // 'survival' only at 30 players
  series: Series[]; // every series created so far, in play order
  currentSeriesId?: string; // the "now playing" series
  tieDraws: TieDraw[]; // recorded random draws: { key, order, drawnAt }
  semifinalPicks?: { fillIns: PlayerId[] }; // host picks for the empty spots at 21/24
  semifinalDraft?: [PlayerId, PlayerId, PlayerId][]; // host's arrangement of the semifinal groups before they start; absent = seeded
}

interface Series {
  id: string; // G1..G10, P (survival game), S1..S3, F
  stage: 'group' | 'survival' | 'semi' | 'final';
  label: string; // "Group 3", "Survival game", "Semifinal 2", "Grand final"
  playerIds: [PlayerId, PlayerId, PlayerId];
  winsNeeded: 1 | 2 | 3; // 2 groups and semifinals, 3 the grand final, 1 the survival game
  games: { placement: [first, second, third]; savedAt: string }[];
  startedAt?: string; // set by "Show as live" or the first saved game
  winnerOverride?: { playerId: PlayerId; reason: string };
  poll?: { ballots: { username; playerId }[]; recordedAt: string }; // vote counts are derived
  gamesPoll?: { line: number; ballots: { username; pick: 'over' | 'under' }[]; recordedAt: string };
}
```

Notes:

- **Ballots and display names are public**: the viewer API returns the whole document, including voters' Discord usernames and the whole display-name list (even people who never vote), because the screens and the leaderboard need them. Numeric Discord IDs are never stored.
- Version 1 documents stored `{ id: 'p1', name }` players and ballots with a Discord ID and username. `parseTournament` converts them on load: player ids stay as they were and their names become display names; each ballot keeps its lowercased username (or the Discord ID when the username was empty), so older data keeps working. Username format and unique names are checked only on new input (`setDisplayNames`, `setPlayers`).
- A poll holds at least one ballot and one ballot per Discord member. Polls saved by older versions with only vote counts are dropped on load, since they can't rank anyone; re-import their JSON.
- A tie draw's `key` is its context plus the sorted tied ids, for example `seeding:lan.wwm,minh_99`. The only context in use is `seeding`.
- `semifinalPicks` is checked for shape only (known players, no repeats). Whether a pick still fits the results is derived: if an undone game turns a fill-in into a group winner, that pick simply stops counting and the host is asked to pick again. Older documents may still carry a `dropped` list from when the host picked the winner to leave out at 30 players; it's ignored on load.
- Who the survival game knocked out isn't stored: it's 3rd place in the survival series' only game.
- `parseTournament` ([validate.ts](../apps/pvp/src/lib/validate.ts)) rebuilds the document from untrusted JSON and never throws. It rejects unknown players, invalid placements, games saved after a series was decided, and unsupported player counts.

---

## 5. Core logic

Framework-free functions in [apps/pvp/src/lib](../apps/pvp/src/lib). They use relative `.js` imports because the Vercel Function runs them as plain Node ESM.

| Module             | Responsibility                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `format.ts`        | Supported counts; groups, empty semifinal spots (`fillInSpots`) and extra winners (`dropSpots`, decided by the survival game) per count |
| `series.ts`        | Per-series records (wins, points, games), winner (override first), placement validation                  |
| `ranking.ts`       | `compareRecords`, `rankRecords` with recorded draws, tie keys                                            |
| `qualification.ts` | Group winners and records (works on partial results), `survivalPlan` (winner ranking, the seat cut and its tie), `semifinalSelection` (pick candidates, valid picks, the survival game's loser, semifinalists), seeding order, pending ties |
| `seeding.ts`       | Snake seeding with fewest-move rematch avoidance inside seed tiers                                       |
| `draw.ts`          | Fisher–Yates shuffle, random group draw                                                                  |
| `reducer.ts`       | Every host action and stage transition; replacement candidates                                           |
| `validate.ts`      | `parseTournament` for untrusted input                                                                    |
| `names.ts`         | Username normalizing and format check, display-name lookup with username fallback, parsing of the pasted display-name JSON |
| `polls.ts`         | EasyPoll JSON parsing and matching (voters by username; winner answers read back to usernames through `displayNameIndex`, over/under by keyword), vote shares, over/under outcome (over, under, push, void), crowd records, prediction leaderboard |
| `i18n.ts`          | The English and Vietnamese message mappings, `Translatable`, and locale-aware number, time and "ago" formatting |
| `eta.ts`           | Average minutes per game from save timestamps (gaps over 15 min ignored, at least 3 samples) and expected games left |

### 5.1 Host actions

All changes go through `applyAction(tournament, action, { now, random }) → Result<Tournament>`. It returns an error message instead of throwing, and the host page shows that message.

| Action                                        | Allowed when                                                    |
| --------------------------------------------- | --------------------------------------------------------------- |
| `setName`                                     | Any time                                                        |
| `setDisplayNames`                             | Any time; replaces the whole list. Discord username keys (normalized, no repeats), names 1–32 chars and unique (case and leading emoji ignored), at most 1,000, every participant kept |
| `setPlayers`, `drawGroups`, `startGroupStage` | Setup (players must be 21/24/27/30 distinct Discord usernames, each with a display name) |
| `startSeries`, `saveGame`, `undoGame`         | Series in the current stage, not yet decided (undo: has a game) |
| `overrideWinner`, `clearOverride`             | Series in the current stage; reason required                    |
| `replacePlayer`                               | A group (setup or group stage), semifinal or final with no games or override yet. In a group the newcomer is a reserve with a display name who isn't in the event, and also replaces the leaver in `players` (draws, picks or a draft left over that name the leaver are dropped); otherwise a participant not playing in that stage |
| `swapPlayers`                                 | Setup, group stage or semifinals; two players in different series, neither of which has a game or override (clears both series' polls) |
| `setSemifinalPicks`                           | Group stage at 21/24 players, every group decided; fill-ins must be non-winners, at most the number of spots (partial picks allowed). Clears any semifinal arrangement |
| `arrangeSemifinals`, `resetSemifinalDraft`    | Group stage, once the semifinal groups exist (picks made, ties drawn): swap two players between draft groups, or go back to the seeded groups |
| `recordPoll`, `clearPoll`                     | Any series; record takes the imported ballots (at least one, one per member) |
| `recordGamesPoll`, `clearGamesPoll`           | Any series that isn't a single match; same ballot rules, and the phase's fixed line is copied into the recorded poll |
| `resolveTies`                                 | There are pending ties (repeats while new ties surface)         |
| `advance`                                     | Every series in the stage decided, semifinal picks complete (group stage), no pending ties |
| `reopenStage`                                 | After setup; groups → setup only while no group has results     |
| `reset`                                       | Any time; keeps the display names (earlier saves stay restorable) |

`advance` creates the next stage's series: at 30 players, the survival game first (`P`, one game, once any tie at the seat cut is drawn); then the semifinals (`S1`–`S3`) exactly as arranged (or seeded), first to 2; then the grand final (`F`, first to 3); then `done`. `overrideWinner` doesn't apply to the survival game, and `reopenStage` steps back through it (semifinals → survival game → group stage; leaving the survival stage removes the game). A draft that no longer holds exactly the current semifinalists (say, after new picks) is ignored and the seeded groups are used. Going back from the semifinals keeps the host's picks and turns the semifinal groups back into the draft, so nothing has to be redone. A new participant list or a redraw clears both.

The host page uses `crypto.getRandomValues` for draws, so no one can claim the draw was rigged.

---

## 6. UI / UX

### 6.1 Viewer page

- **Layout**: a brush-script title under a "武林大会" seal, then the bracket in the main column and the prediction leaderboard beside it. On wide screens (≥ 1024 px) the leaderboard is a sticky side column, so it never scrolls away; on phones it docks at the bottom of the screen with the current leader and opens as a sheet.
- **Bảng Thần Toán / Oracle Ranking** (the prediction leaderboard): a hanging scroll with the crowd's record on both questions and every member ranked by correct picks (winner, over/under and total). Ties share a rank, and the top three wear the imperial exam's seals: 状元 Trạng nguyên, 榜眼 Bảng nhãn, 探花 Thám hoa. It shows even before the first predicted series finishes, so viewers know where to look.
- **Now playing**: the live series with each player's game placements and win pips, plus "next series in about N minutes" once there's enough timing data. When nothing is live: "Waiting for the host to start the next series" and the next series "on deck".
- **Road to the semifinals** (group stage, and the survival game at 30 players): the qualification rule in plain words for the player count, the group winners, and the host's picks; at 30 players also who plays the survival game (or a note while its last seat waits for a draw) and who it knocked out, struck through among the winners.
- **Survival game** (30 players): its own bracket section under a 危 seal, shown as a draft as soon as the seats are settled. The card has no crown: it marks the player who finished 3rd as out, explains "1st and 2nd go through, 3rd is out", and its vote shares are predictions for who goes out.
- **Series cards**: per-game place chips, win pips, crown for the winner, "Live / Finished / Upcoming", the series length ("first to 2", "first to 3" or "one match"), vote shares when a poll was recorded, the over/under line with its vote split and, once finished, the result ("3 ván: Trên"), and the reason for any override.
- **Recent results** (newest first; identical timestamps fall back to play order).
- **Motion**: sections and cards fade in, a saved game's placing is stamped onto the card, a win pip fills like a drop of ink, the live card glows with a "战" seal, the champion banner is stamped in with a gold sheen, and leaderboard rows slide to their new rank and flash when a member's score goes up. Plum petals fall and mist drifts behind the page. All of it is off when the device asks for reduced motion. The full look and motion catalogue is in §6.4.
- Status shows "Live · updated just now" or "Offline", and the last good state stays on screen while offline.

### 6.2 Host page

- **PIN gate**: the PIN is kept in `sessionStorage` for the tab and sent as the `x-host-pin` header. A wrong PIN, or a PIN changed on the server, sends the host back to the gate.
- **Setup**: paste the display-name JSON (or choose a file) and save; paste the participants' Discord usernames one per line (with or without "@", any case), which previews their display names and flags anything that isn't a valid username, is repeated or has no display name; save, draw groups (redraw any time before starting), adjust the draw by tapping two players in different groups to swap them, then start the group stage.
- **Rearrange players** (group stage and semifinals, collapsed under the series list): the same tap-to-swap for groups that haven't started; started groups are shown locked. In the semifinals each name shows its first-round group, and rematches are flagged.
- **Game entry**: tap the winner, then the runner-up; third place fills itself in. Save, Undo last game, and "Show as live" to mark a series as playing before its first result. Picks clear as soon as a game is saved, so a double tap can't save it twice.
- **Poll panel**: two sections, "who wins?" and (except single matches) "over/under games" with the phase's fixed line. Each has copy-ready question and answers, a votes JSON import with preview (the only way to record votes), and a clear button once recorded.
- **Stage gate** (once every series in the stage is decided): who's through; at 21 or 24 players, the semifinal picker (candidates with group and record; it folds to a one-line summary with "Change" once complete); at 30 players, the 10 winners best first with their records, the three survival seats marked (certain seats solid, players tied for the last seat dashed until the draw); pending ties and the draw button, recent draws, the semifinal groups as viewers see them with tap-to-swap (and "Back to the seeded groups" after any swap), and the advance button ("Start the survival game", "Start the semifinals", "Start the grand final", "Finish the tournament"). After the survival game, the gate names who went out.
- **Save indicator**: "Saving…", "All changes saved", or "Not saved" with a retry button.
- **Host tools**: see §2.4, plus "Display names" once the event has started (the same JSON editor as in setup, for typos and voters missing from the list), "Restore an earlier save" (last 50 saves), "Download JSON" (backup after each stage), and "Reset" (type RESET to confirm). Destructive tools ask for confirmation.

### 6.3 Languages

The app speaks **Vietnamese (default) and English**, switched with the VI / EN toggle in the header of both pages (and on the PIN screen). The choice is remembered in `localStorage` per browser and sets `<html lang>` and the page title.

- All text lives in one mapping, [apps/pvp/src/lib/i18n.ts](../apps/pvp/src/lib/i18n.ts): English defines the shape and Vietnamese must match it key for key, so a missing translation fails the typecheck.
- Errors from the rules (`applyAction`), the votes JSON parser and the API come back as functions of the messages, so they render in whichever language is selected, even after switching.
- Series names ("Bảng 3", "Bán kết 2", "Chung kết") are derived from the series id and stage. The English `label` stored in the document is kept only for older data.
- Numbers follow the locale: "1,33 điểm/ván", "Trên 2,5 ván" in Vietnamese; "1.33 pts/game", "Over 2.5 games" in English. Times use the 24-hour clock in both.
- Poll questions copy in the selected language. The importer reads over/under answers in either language, so a poll posted in one language and imported in the other still works. Winner answers are display names, which aren't translated.

### 6.4 Visual style guide

The reference for any UI work. The two pages deliberately have different personalities, and both are mobile-first. Everything lives in [apps/pvp/src/index.css](../apps/pvp/src/index.css) and [apps/pvp/src/components/viewer](../apps/pvp/src/components/viewer).

#### Vision

- **Viewer page: a living martial-arts scroll.** Guild members watching on their phones should feel like guests at a wuxia tournament, seeing results inked onto rice paper and stamped with seals. It's playful, artistic, warm and a little theatrical, never a corporate dashboard. It must still read at a glance during the event.
- **Host page: the scorekeeper's desk.** Dark, plain, dense and fast, built for one person entering results under time pressure. No decoration and no extra animation; keep it that way.

#### Principles

1. **Paper and ink first.** Content sits on paper surfaces in ink-coloured text. Colour is an accent, not a fill.
2. **Cinnabar is the stamp, not the paint.** Red is for seals, brush strokes, the live card and errors only. Never use it for large areas or body text.
3. **Decoration serves, never blocks.** The scenery stays behind the content at low opacity, and text contrast comes first. Every decorative element is `aria-hidden`, ignores the pointer, and never carries meaning on its own.
4. **Bilingual by default.** Every font must cover Vietnamese. Check diacritics (Đ, ạ, ổ, ữ) and long Vietnamese strings, which run longer than English.
5. **Motion says "something happened."** Stamps, ink drops and slides mark real events. Ambient motion lives only in the backdrop, on the live card and on the champion. Reduced-motion settings switch it all off.
6. **Phone first.** Design at 390 px wide, then widen. The prediction leaderboard must always be reachable (§6.1).

#### Palette

The viewer redefines Tailwind's colour tokens under `html.wuxia`; the host keeps the dark values. Use the tokens (`bg-surface`, `text-fg`, `border-border`, `text-gold`, …), never raw colours, in shared components.

| Token           | Viewer (light)     | Host (dark) | Use                                                        |
| --------------- | ------------------ | ----------- | ---------------------------------------------------------- |
| `bg`            | `#f3ead6` parchment | `#0f0f0f`  | Page; the viewer adds a paper grain and soft light falling from the top |
| `surface`       | `#fbf6ea` paper    | `#1a1a2e`   | Panels; viewer paper is a gradient `#fffcf5` → `#faf2e2`   |
| `surface-hover` | `#f1e6cc`          | `#242442`   | Hover and pressed states                                   |
| `fg`            | `#2a221c` ink      | `#e8e6e3`   | Text                                                       |
| `muted`         | `#7a6754` sepia    | `#9b9b9b`   | Secondary text, labels                                     |
| `gold`          | `#9c650e` ochre    | `#c9a84c`   | Winners, first place, crowns, the leader's row             |
| `red`           | `#b3362b` cinnabar | `#c94c4c`   | Seals, brush strokes, the live card, errors                |
| `green`         | `#2e7a57` jade     | `#5fae7b`   | Qualified ("through"), the live dot                        |
| `border`        | `#dac69b` tan      | `#2a2a3e`   | Frames, dividers (dashed inside paper)                     |

Fixed viewer accents that aren't tokens: seal text `#fff6ea`, ink seals `#2a221c`, ochre seals `#9c650e`, the gold coin (`#f0c868` → `#a8700f`), the silver coin (`#ffffff` → `#c9c2b4`), the champion's gilt (`#c79a3a` frame, `#8a5a0c` name), the scroll's wooden rods (`#8b5a2b` → `#3e230d`) and the plum petals (`#f6c9c4` → `#e08d8a`).

#### Typography

| Role    | Font (Tailwind)                 | Where                                                       | Rules |
| ------- | ------------------------------- | ----------------------------------------------------------- | ----- |
| Display | Water Brush (`font-brush`)      | Event title, champion name, empty-state flourish            | Large sizes only (about 1.9 rem and up). Never for UI text, numbers or anything longer than a name |
| Text    | Alegreya (`font-serif`, the viewer default) | Everything else                                 | Headings at weight 800; section titles uppercase with 0.14 em letter spacing; names semibold or bold. Lining numerals are set globally, because Alegreya's old-style figures make scores look uneven |
| Seal    | Ma Shan Zheng (`font-seal`)     | Chinese glyphs inside seals only                            | Simplified characters only (it's a Simplified Chinese font), and only those in the subset URL in `index.html` |
| Host    | System sans                     | The whole host page                                         | Unchanged |

All three viewer fonts load from Google Fonts in `index.html`; Ma Shan Zheng is requested with `text=` set to exactly the seal glyphs, so it downloads only a few kilobytes.

#### Motifs and building blocks

- **Paper** (the `paper` class; series cards get it automatically): the paper gradient, a 1 px tan border, a 0.75 rem radius, and `--paper-shadow`, which draws a fine ochre frame 3–4 px inside the edge plus a soft drop shadow. Use it for every new viewer panel, with dashed tan dividers inside.
- **Seals** (`<Seal text size tone />` in `components/viewer/Seal.tsx`): carved chops tilted −5° as if stamped by hand. Sizes: `sm` holds one glyph (section headings), `md` two glyphs stacked (leaderboard, rank seals, phone dock), `lg` four glyphs in a 2 × 2 block read right to left (header). Tones: `cinnabar` (default), `ink`, `ochre`. They're always decorative: the meaning must also be in text.

  | Glyphs   | Meaning           | Where                                  |
  | -------- | ----------------- | -------------------------------------- |
  | 武林大会 | martial gathering | Page header                            |
  | 战       | battle            | "Now playing" heading, the live card   |
  | 路       | road              | "Road to the semifinals"               |
  | 组       | group             | Group stage                            |
  | 危       | peril             | Survival game (30 players)             |
  | 半       | half              | Semifinals                             |
  | 决       | decisive          | Grand final                            |
  | 录       | record            | Recent results                         |
  | 神算     | divine reckoning  | Prediction leaderboard                 |
  | 状元 榜眼 探花 | the imperial exam's top three | Ranks 1–3 on the leaderboard, with tooltips naming the title in the selected language (Trạng nguyên, Bảng nhãn, Thám hoa) |
  | 冠军     | champion          | Champion banner                        |

- **Section headings** (`Section` with `icon={<Seal text='…' />}`): seal, uppercase serif title, and a cinnabar brush stroke that sweeps in underneath.
- **Header**: the 武林大会 seal stamps in, the event name in brush script, a cinnabar stroke that draws itself, then the stage on a small paper pill and a live dot that pings.
- **Series cards**: placings as coins (1st gold, 2nd silver, 3rd outlined), wins as ink drops, a gently bobbing crown for the winner, and a lift on hover. The live card gets a cinnabar border, a slow glow and a 战 seal on its corner.
- **Champion banner**: a gilded scroll with the name in brush script, a 冠军 seal and a gold sheen that passes over it.
- **Prediction leaderboard**: a hanging scroll (`scroll-board`, wooden rods top and bottom) around paper. Rank seals mark the top three; everyone else gets a numbered circle. The leader's row is tinted gold, with the score large and the picks small.
- **Backdrop** (`InkBackdrop`): a pale cinnabar sun, three ink-wash ridges at 7–14 % opacity, three drifting mist bands and nine falling plum petals. It's fixed behind everything, and its positions are fixed in code (no randomness), so it looks the same on every device.
- **Layout**: `max-w-7xl`; at 1024 px and up, the main column plus a 21 rem sticky side column for the leaderboard; below that, a bottom dock that opens a sheet, with bottom padding so it never covers content. Sections sit `gap-10` apart; series grids run one, two (`sm`) or three (`xl`) columns.

#### Motion

| Animation                         | Where                                               | Timing                                             | Trigger |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------- | ------- |
| `fade-up`                         | Sections, series cards, feed rows, winner chips     | 0.7 s ease-out, staggered 70 ms (up to 5)          | Mount   |
| `stamp`                           | Seals, place coins, the live 战, the champion's 冠军 | 0.5–0.7 s with overshoot (`cubic-bezier(0.2, 1.5, 0.4, 1)`) | Mount: a new game mounts a new coin |
| `ink-drop`                        | Win pips                                            | 0.55 s with overshoot                              | A pip remounts when it fills (keyed by state) |
| `brush-sweep`, `draw`             | Section underline, title stroke                     | 0.9–1.3 s                                          | Mount   |
| `live-glow`                       | The live card                                       | 2.6 s, looping                                     | Always while live |
| `crown-bob`                       | The winner's crown                                  | 2.8 s, looping, small                              | Always  |
| `champion-in`, `gold-sheen`       | Champion banner                                     | 0.9 s, then a 4.5 s loop                           | Mount   |
| Rank slide, score flash           | Leaderboard rows (`useRankMotion`, Web Animations API) | 600 ms slide, 1.8 s gold flash                  | Rank or score changes |
| `sheet-up`, `fade-in`             | Phone leaderboard sheet and its backdrop            | 0.45 s, 0.3 s                                      | Open    |
| `drift`, `petal-fall`, `petal-sway`, `sun-float` | Backdrop                             | 9–90 s, looping                                    | Always  |

Rules:

- Animate `transform`, `opacity` and `box-shadow` only.
- Keep every animation under `.wuxia`, so the host never moves.
- Entrance animations use `animation-fill-mode: backwards`, so a hover transform still works once they finish.
- Key elements by stable ids, so the 4-second polling doesn't replay entrances.
- The reduced-motion media query turns all CSS motion off, and JavaScript motion checks `matchMedia('(prefers-reduced-motion: reduce)')`.
- Don't add new looping motion to content; ambient motion belongs in the backdrop.

#### Voice

Wuxia flavour goes in names and decoration; instructions and data stay in plain words. For example, the leaderboard is titled "Bảng Thần Toán" / "Oracle Ranking" with a plain subtitle underneath, and the imperial exam titles appear as tooltips. Vietnamese comes first. Copy rules are in [apps/pvp/AGENTS.md](../apps/pvp/AGENTS.md).

#### Do and don't

Do:

- Build new viewer UI from the tokens, `paper`, `Seal`, and `Section` with a seal icon.
- Restyle shared components for the viewer through hook classes under `.wuxia` (`series-card`, `place-chip`, `win-pip`, `champion-banner`, `section-title`).
- Before finishing, check a 390 px phone and a desktop at 1024 px or wider, both languages, reduced motion, and that `/host` looks unchanged.

Don't:

- Bring dark panels, glossy gradients, neon, glassmorphism, heavy dashboard shadows or emoji into the viewer.
- Use the brush font for small text or numbers, or red for large areas or body text.
- Use Chinese glyphs outside the subset, or traditional characters such as 會 or 戰.
- Decorate the host console.

#### How the theme switch works

`index.html` adds the `wuxia` class to `<html>` on every path except `/host` before the first paint, mirroring `IS_HOST` in `src/App.tsx`, so the viewer never flashes dark. Tailwind's colours are CSS variables, so `html.wuxia` redefines them and the shared components (series cards, sections, the champion banner, the language switch) restyle on the viewer page only. Viewer-only decoration hangs off the hook classes above, which the dark theme leaves unstyled. The viewer rules in `index.css` are deliberately unlayered, so they win over Tailwind's utility classes on those shared components.

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

The host's full step-by-step list, with every button in both languages and a "when something goes wrong" table, is [pvp-host-checklist.md](pvp-host-checklist.md). This is the short version.

1. Before the event: open `/host`, enter the PIN, set the event name, paste the display-name JSON (every participant plus everyone likely to vote), then paste the participants' Discord usernames.
2. Draw the groups (redraw if needed, or swap individual players) and share the viewer link in Discord. The draw shows on the viewer page right away. If someone doesn't show up, swap in a reserve with Host tools → "Replace a player" before their group plays (add the reserve to the display names first).
3. For each series: "Show as live", post the two EasyPolls (winner and over/under) from the copied questions and answers, and record each game with two taps. When a poll closes, run the console snippet on its EasyPoll votes page and paste the copied JSON into the matching section of the poll panel. The JSON is the only way to record votes, so import both polls for every series, ideally before it finishes, so the predictor leaderboard updates as soon as the result is saved.
4. At the end of the group stage: at 21 or 24 players pick who fills the empty semifinal spots. At 30, draw for the last survival seat if the gate asks, start the survival game, post its "who goes out?" poll, and record it like any other game. Then break any seeding ties with the draw button. The semifinal groups now appear for viewers: rearrange them if needed and start the semifinals. Then post the semifinal polls from each series' poll panel.
5. Download the JSON backup after each stage.

---

## 10. Implementation phases

### Phase 1 — MVP (implemented)

- [x] `apps/pvp` scaffold (Vite + React + TS + Tailwind 4, port 2140), root scripts `dev:pvp` / `build:pvp`
- [x] Pure rules: format, series records, ranking with recorded draws, qualification, snake seeding, reducer, validation, ETA, polls
- [x] API + storage: one Vercel Function, Upstash Redis with compare-and-set and capped history, PIN auth, dev middleware
- [x] Host page: PIN gate, setup and draw, two-tap entry, polls import, stage gate, host tools
- [x] Host control over line-ups: tap-to-swap players in the group draw and the semifinals; host picks for empty semifinal spots (21, 24), replacing the runner-up and play-in rules; reserves for no-shows in groups that haven't played, without a redraw
- [x] Survival game at 30 players: the 3 weakest group winners play one game, 3rd place is out, with a recorded draw for a tie at the seat cut and a "who goes out?" poll
- [x] Second prediction per series: over/under games with a fixed line per phase (2.5, 2.5, 4.5), in the poll panel, series cards and leaderboard
- [x] First-to-3 grand final
- [x] Vietnamese (default) and English, from one translation mapping, with a VI / EN switch
- [x] Viewer page: now playing, road to the semifinals, bracket, predictions, recent results
- [x] EasyPoll dashboard table → votes JSON: DevTools console snippet and `pnpm easypoll:json`
- [x] Votes JSON required for every poll (typed counts removed), so the predictor leaderboard covers every vote
- [x] Participants and predictors identified by Discord username; one host-pasted username → display name list names them everywhere (schema version 2, version 1 documents converted on load)

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
