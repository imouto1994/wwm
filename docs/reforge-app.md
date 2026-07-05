# Where Winds Meet — Reforge Pity Tracker

## Product & Technical Specification

---

## 1. Overview

### 1.1 Vision

A fast, client-side single-page app that lets _Where Winds Meet_ players **track the pity of a weapon-skin reforge session**. Reforge is a gacha system with five separate nodes, each with its own pity counter, lock state, and per-roll cost. Rather than logging every single roll, the player records a **milestone** whenever something notable happens — a node turns gold, a node is locked/unlocked, or the look is reverted — entering how many rolls happened since the last milestone. The app derives a per-node **status table** from those milestones: each node's pity, tier, lock state, and the running roll/stone totals.

This is the second app in the `wwm` monorepo, alongside the [Boss Guide](SPEC.md). It is intentionally a **pure tracker** — it does not simulate rolls or advise strategy; the player performs rolls in-game and records the milestones.

### 1.2 Goals

| #   | Goal                                            | Success Metric                                             |
| --- | ----------------------------------------------- | ---------------------------------------------------------- |
| 1   | Accurately track per-node pity across a session | Pity counters match in-game state with minimal input       |
| 2   | Keep input low-effort and miss-free             | One milestone per gold event; many rolls batched at once   |
| 3   | Persist sessions with zero setup                | State survives reloads via localStorage; no account needed |
| 4   | Match the Boss Guide's wuxia aesthetic          | Shared dark ink-wash palette                               |

### 1.3 Target Audience

- Players actively reforging a weapon skin who want to know when to keep rolling vs. lock a node.
- Players budgeting stones across a long reforge session.

---

## 2. Reforge Mechanics (domain reference)

Full source: [docs/reforge.md](reforge.md). The rules the app models:

### 2.1 Nodes

A weapon skin has **5 nodes**:

| Node | Name   | Notes                                                                 |
| ---- | ------ | --------------------------------------------------------------------- |
| 1    | Node 1 | ~10 gold variances: 2 align with Set A / Set B, plus ~8 unique colors |
| 2    | Node 2 | 2 gold variances (Set A / Set B) + purple + blue                      |
| 3    | Node 3 | 2 gold variances (Set A / Set B) + purple + blue                      |
| 4    | Node 4 | 2 gold variances (Set A / Set B) + purple + blue                      |
| 5    | Node 5 | **Special** — in-game "Highlight"; see 2.5                            |

### 2.2 Tiers and Sets

- Three tiers per node: **Gold** (best), **Purple** (average), **Blue** (low).
- Gold has two "sets" per skin: **Set A** and **Set B**. The ideal look is all five nodes gold in the _same_ set.
- Node 1 additionally has ~8 unique gold colors outside the two sets (for players who want a custom color).

> The tracker intentionally does **not** record which set/variant a gold lands on — only that a node is gold. Variant is cosmetic and irrelevant to pity, so it is omitted to keep input minimal.

### 2.3 Pity

- Each node has an **independent** pity counter.
- A roll increases pity by 1 for every node that is **enabled and unlocked**.
- Pity **resets to 0** when that node hits gold.
- **Hard pity = 90** (guaranteed gold). Observed **soft pity ≈ 30-40**.

### 2.4 Unlocks (manual, sequential)

Nodes unlock sequentially (Node 1 -> 2 -> 3 -> 4 -> 5) as total rolls accumulate, but the roll totals that trigger each unlock **vary per weapon skin**, so the app does **not** derive them from a fixed threshold. Instead the player records an **unlock milestone** when a node lights up in-game. Node 1 (Color) is the only node enabled from the start. Pity is only tracked once a node is enabled, and unlocks are **permanent**.

The unlock roll counts as the node's first pity, so a freshly unlocked node reads **pity 1** (Misc/Node 5 has no pity and turns gold instead). The UI enforces the sequential order - only the next locked node can be unlocked.

> Earlier versions auto-enabled nodes at fixed totals (24 / 40 / 70 / 99). Those are now kept only as `LEGACY_UNLOCK_ROLLS` to migrate pre-manual sessions (see §7.3).

### 2.5 Node 5 (Misc) — special

- No blue/purple tier. Once enabled, it is **permanently gold**.
- Its gold value is **derived** in-game from the other nodes' set, not rolled. Since the tracker does not track sets, it simply shows Node 5 as **gold** once enabled.
- It has **no pity** and is **not lockable / not counted** in the per-roll cost.

### 2.6 Locking and roll cost

- Any enabled node can be **locked** so a roll will not re-randomize it; a locked node's pity is frozen and does not advance.
- Cost scales with the number of locked nodes. Because only nodes 1-4 are rollable, the maximum while still rolling is 3 locked:

| Locked nodes | Stones per roll |
| ------------ | --------------- |
| 0            | 1               |
| 1            | 2               |
| 2            | 5               |
| 3            | 10              |

### 2.7 Color Node constraint (informational)

Node 1 can only roll a Set A/B gold once **another** node already holds that set's gold (or both land in the same lucky roll). The app surfaces this as a small note; it does not block input.

### 2.8 Revert

- In-game a player can save a look and later **revert** to it. Per the in-game behavior, reverting **resets every node's pity to 0** (so pity-stacking via save/revert is not feasible).
- The tracker models a revert as a milestone: the player records the reverted look (gold/lock per node) and all pity is zeroed. Stones already spent and total rolls are kept (unlocks are permanent). There are no named "plans" — the milestone log itself is the saved data.

---

## 3. Information Architecture

A single screen (no routing). Top to bottom:

```
Reforge Pity Tracker (/)
├── Header (title)
└── Three-column layout (stacks on mobile; rails are sticky on desktop)
    ├── Legend (left) — static key for the table's color / pulse / mark cues
    ├── Tracker (center)
    │   ├── SessionBar (active-session select · New · manage menu: rename / delete)
    │   ├── CurrentStateBar
    │   │   ├── totals (total rolls · stones spent · roll cost)
    │   │   ├── per-node chips (pity · gold-tinted when gold · lock toggle · "about to pop" pulse)
    │   │   └── actions (Add Rolls · Restore Plan · Reset)
    │   ├── Milestone form (inline; shown when adding or editing a roll/revert milestone)
    │   └── MilestoneTable (rows = milestones, columns = the 5 nodes + roll/stone totals)
    └── GoldStats (right) — gold counts per pity range (size-5 buckets)
```

Everything in the tracker column reflects the **active** session; switching sessions swaps the whole view (current state, forms, table, and the gold-luck stats). Locking/unlocking an **enabled** node is done by clicking its chip's lock toggle (appends a lock milestone); **enabling** the next not-yet-unlocked node is done by its chip's Unlock button (appends an unlock milestone). The current state is simply the last row of the table.

---

## 4. Data Model

Each session is an ordered list of milestone **inputs**; its table is _derived_ by replaying them (nothing computed is persisted). The app holds many named sessions and remembers which one is active. Defined in [apps/reforge/src/types/reforge.ts](../apps/reforge/src/types/reforge.ts):

```typescript
type NodeId = 1 | 2 | 3 | 4 | 5;
type Tier = "blue" | "purple" | "gold"; // in practice only 'gold' or null is tracked

// Derived per-node state (produced by replay; only authored via a revert input).
interface NodeSnapshot {
  id: NodeId;
  enabled: boolean; // unlocked yet? derived from cumulative rolls (permanent)
  locked: boolean; // frozen pity + raises roll cost
  pity: number; // rolls toward next gold; 0 on gold; always 0 for Node 5
  tier: Tier | null; // 'gold' (held by a lock) or null; Node 5 is gold once enabled
}

interface RevertNodeInput {
  id: NodeId;
  gold: boolean;
  locked: boolean;
}

// The user-authored unit; everything else is derived from an ordered array.
// A roll's goldHits is just the ids of the nodes that turned gold (no variant -
// this is a pure pity tracker). An `unlock` enables a node (pity 1; Misc gold) -
// recorded manually because the unlock roll totals vary per weapon.
type MilestoneInput =
  | { id: string; type: "roll"; rolls: number; goldHits: NodeId[] }
  | { id: string; type: "unlock"; nodeId: NodeId }
  | { id: string; type: "lock"; nodeId: NodeId; locked: boolean }
  | { id: string; type: "revert"; nodes: RevertNodeInput[] };

// A derived row: input + running totals + the full snapshot after applying it.
interface Milestone {
  input: MilestoneInput;
  index: number;
  rolls: number;
  cumulativeRolls: number;
  stones: number;
  cumulativeStones: number;
  nodes: NodeSnapshot[];
  label: string;
  goldPity?: Partial<Record<NodeId, number>>; // pity-at-gold per node golded here
}

// A named session is just its ordered inputs; its table is derived on demand.
interface Session {
  id: string;
  name: string;
  inputs: MilestoneInput[];
}

// v4 holds many named sessions plus the active one's id. Older shapes are
// migrated on load - v2 (single `inputs` array) and v3 (pre-manual-unlock) both
// have their unlock milestones synthesized. See storage.ts#coerceState.
interface PersistedState {
  version: 4;
  sessions: Session[];
  activeSessionId: string;
}

// JSON envelope for a single exported/imported session (one file = one session).
// `exportVersion` is the file-format version, separate from PersistedState.version;
// v2 carries explicit unlocks (v1 files are migrated on import); the session id is
// omitted and minted fresh on import. See lib/sessionIo.ts.
interface SessionExport {
  type: "wwm-reforge-session";
  exportVersion: 2;
  exportedAt: string;
  name: string;
  inputs: MilestoneInput[];
}
```

`goldPity` records how many rolls each node took to gold in that milestone (its pity just before the reset). The snapshot pity is 0 afterward, so `goldPity` is what drives the gold-luck cell color.

Constants live in [apps/reforge/src/lib/constants.ts](../apps/reforge/src/lib/constants.ts): `INITIALLY_ENABLED_NODE_IDS` (just Node 1), `LEGACY_UNLOCK_ROLLS` (migration-only - see §7.3), `ROLL_COST_BY_LOCKED`, `SOFT_PITY`, `HARD_PITY`, `ROLLABLE_NODE_IDS`, `AUTO_GOLD_NODE`, `GOLD_LUCK` (30/50 color thresholds), `SOON_PITY` (about-to-pop floor), and `GOLD_BUCKET_SIZE` (pity-range width for the gold-luck stats).

---

## 5. Core Logic

Framework-free, unit-tested functions in [apps/reforge/src/lib/engine.ts](../apps/reforge/src/lib/engine.ts) (tests in [engine.test.ts](../apps/reforge/src/lib/engine.test.ts)).

### 5.1 Replay

`replay(inputs)` folds the milestone inputs into derived `Milestone[]` snapshots. The current state is the last snapshot (or `createInitialNodes()` when empty). Because lock changes are their own milestones, the lock config is constant within every roll segment.

```mermaid
flowchart TD
    inputs["MilestoneInput[]"] --> fold["replay: fold from initial nodes"]
    fold --> kind{"input type"}
    kind -->|"roll"| r["cumRolls += N; pity += N for enabled, unlocked nodes; golds -> pity 0 + record goldPity; stones += N * cost(lockedCount)"]
    kind -->|"unlock"| u["enabled = true; pity = 1 (Misc: tier gold, pity 0); 0 rolls/stones"]
    kind -->|"lock"| l["toggle node.locked (0 rolls/stones)"]
    kind -->|"revert"| v["set gold + lock per node (no variant); all pity = 0; enabled kept"]
    r --> snap["push snapshot"]
    u --> snap
    l --> snap
    v --> snap
```

### 5.2 Pity accrual

Since unlocking is its own milestone (which already grants the first pity), a roll segment simply adds `rolls` to every node that is enabled and not locked - no unlock-threshold clamp:

```typescript
const accruing = node.locked || !node.enabled ? 0 : rolls;
const reached = node.pity + accruing; // pity-at-gold when this node is a gold hit
node.pity = isGoldHit ? 0 : reached; // reset on gold (only enabled nodes can gold)
```

`applyUnlock` enables a node and sets its pity to 1 (the unlock roll), or marks Misc gold with pity 0. It is idempotent, so re-unlocking an already-enabled node never resets its pity.

### 5.3 Cost

`rollCost(lockedRollableCount(prevNodes))` — locked nodes among 1-4 only (Node 5 excluded); table from 2.6 (clamped to 3). A segment costs `rolls * cost`.

### 5.4 Node 5 derivation

Node 5 turns gold the moment it is unlocked (its `unlock` milestone sets `tier: 'gold'`, pity 0); it is never rolled and has no pity. The in-game set derivation is not modeled (variant is not tracked).

### 5.5 Revert

`applyRevert` sets each node's `tier` (gold or null) and `locked` from the input and zeroes all pity. No variant is captured. `enabled` (permanent unlocks), `cumulativeRolls`, and `cumulativeStones` are preserved.

### 5.6 Luck color and "about to pop"

`goldPityColor(pity)` → `green` (`<= 30`) / `yellow` (`<= 50`) / `red` (`> 50`) — inclusive bounds that line up with the size-5 GoldStats buckets. `isSoon(node)` → true for an enabled, unlocked, non-gold node whose `pity >= 30`.

### 5.7 Gold-luck distribution

`goldPityDistribution(milestones)` pools every recorded gold hit (each milestone's `goldPity`, across the rollable nodes — Node 5 has no pity and is excluded) into fixed `GOLD_BUCKET_SIZE`-wide ranges spanning `1..HARD_PITY` (e.g. `1-5, 6-10, … 86-90`) and returns the buckets plus the total gold count. Because it reads `goldPity`, it counts every gold _event_ in the session (even ones later re-rolled away) and re-derives on edit/delete. The `GoldStats` rail renders it as colored bars (the same luck colors as the table) across the full set of pity ranges, including empty ones, so the scale stays stable.

### 5.8 Notes

- **Minimal input**: only gold hits affect pity; non-gold blue/purple results are not required.
- **Re-rolling an unlocked gold** clears its gold marker (it was gambled away) and pity climbs from 0 again — so a gold star only persists into later rows when the node is **locked**.
- **Unlock before gold**: a node must be unlocked (its own milestone) before its golds can be recorded - the roll form only offers already-unlocked nodes. So a node that unlocked during a batch is recorded as an unlock first, then its gold on a following roll.

---

## 6. UI / UX

### 6.1 Components ([apps/reforge/src/components](../apps/reforge/src/components))

- **SessionBar** — switches and manages sessions: a native `<select>` of all sessions (the accessible, mobile-friendly choice), a **New** button, and a kebab manage menu with **Rename** (inline text field; trims, blocks empty, Enter saves / Escape cancels), **Export** (downloads the active session as JSON), **Import** (reads a JSON file and adds it as a new session), and **Delete** (confirm). The menu closes on outside-click / Escape and its popover sits above the table's sticky cells. Deleting the active session selects a neighbor; deleting the last one creates a fresh default. Export/import logic lives in the pure [sessionIo.ts](../apps/reforge/src/lib/sessionIo.ts) (validates the file envelope and strictly sanitizes inputs); the DOM glue (download/file-read) is the only non-pure part.
- **CurrentStateBar** — session totals, roll cost, a per-node chip row (pity, a gold border + star when the node is gold instead of a tier word, inline lock toggle, the about-to-pop pulse), and the action buttons (Add Rolls, Restore Plan, Reset — Reset clears the **active** session's milestones, distinct from SessionBar's Delete). A locked-out (not-yet-unlocked) node's chip shows an **Unlock** button, but only for the next node in sequence (via `nextUnlockableNodeId`); later nodes read "after &lt;previous node&gt;". Unlocking Misc turns it gold.
- **MilestoneTable** — the milestone log: a Start baseline row plus one row per milestone. Columns are the 5 nodes (each cell: tier marker + pity, lock icon; Node 5 shows gold once enabled) and the roll/stone totals. A gold-hit roll's Milestone label shows each node name followed by a gold star icon (e.g. "Node 1 _, Node 2 _") rather than the longer "-> Gold" text. Edit/Delete appear on the latest row only (Edit hidden for lock **and unlock** rows, which carry no roll/revert data). Horizontally scrollable with a sticky `#` column on mobile.
- **RollMilestoneForm** — `rolls >= 1`, plus a "turned gold" checkbox (no variant) for each rollable node that is already **unlocked** and not locked (via `rollableNodes`). A node must be unlocked from its chip first, so the form notes that and offers no future-unlock projection. Shows the current lock config read-only. Doubles as the edit form for the latest roll milestone.
- **RevertMilestoneForm** — per enabled node a gold + lock toggle (no variant); all pity resets to 0. Surfaced as the "Restore Plan" action (the in-game save/restore).
- **Legend** — a static left rail keying the table's cues (gold-luck colors with their thresholds, the about-to-pop pulse, and the star / lock / Misc-auto-gold marks). Reuses the same constants and `LUCK_BG` classes as the table so it never drifts.
- **GoldStats** — a right rail showing the gold-luck distribution: per pity range (size-5 buckets) a colored bar plus the count, with a total. Pure data from `goldPityDistribution`; re-derives on edit/delete; empty until the first gold.

### 6.2 Cell highlighting (milestone table)

- **Gold-luck color** — on the row where a node turned gold, the cell background is colored by `goldPity` (rolls it took): green `<= 30`, yellow `31-50`, red `> 50`. The number is shown next to a star icon so color is not the only signal.
- **About-to-pop pulse** — on the **latest row only**, an enabled, unlocked, non-gold node with `pity >= 30` gets a rotating, breathing rainbow gradient ring (`.animate-soon` in [index.css](../apps/reforge/src/index.css)); it honors `prefers-reduced-motion` with a static rainbow ring. The same pulse is mirrored on the current-state chips.
- These cues are keyed in the **Legend** rail (left) rather than a caption under the table; the **GoldStats** rail (right) summarizes the gold-luck distribution across the whole session.

### 6.3 Theme

Dark wuxia ink-wash palette reused from the Boss Guide ([apps/reforge/src/index.css](../apps/reforge/src/index.css), Tailwind 4 `@theme`): `bg #0f0f0f`, `surface #1a1a2e`, `fg #e8e6e3`, `gold #c9a84c`, plus tier colors. Mobile-first: chips reflow into a grid and the table scrolls horizontally.

### 6.4 State

State flows through `useReforgeSession` ([apps/reforge/src/hooks/useReforgeSession.ts](../apps/reforge/src/hooks/useReforgeSession.ts)) — a `useReducer` holding `{ sessions, activeSessionId }`. Milestone actions mutate the **active** session's inputs (leaving the other sessions' array identities untouched, so only the active table re-derives); session actions add/switch/rename/delete. The active session's table is derived via `replay` in a `useMemo`, and the whole list is persisted to `localStorage`. Within a session, only the **latest** milestone can be edited or deleted; every mutation is a list change followed by a re-replay.

---

## 7. Technical Architecture

### 7.1 Stack

| Layer           | Technology                           |
| --------------- | ------------------------------------ |
| Build tool      | Vite 8                               |
| UI              | React 18 + TypeScript 5              |
| Styling         | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Icons           | lucide-react                         |
| Lint/format     | Biome (shared root config)           |
| Testing         | Vitest                               |
| Persistence     | `localStorage` (in-memory fallback)  |
| Package manager | pnpm (workspace)                     |

No router, no backend, no CMS — a pure client-side SPA.

### 7.2 Structure

```
apps/reforge/
├── index.html
├── vite.config.ts          # base: '/', React + Tailwind plugins, '@' alias
├── vitest.config.ts        # node env, '@' alias, src/**/*.test.ts
├── tsconfig.json
├── vercel.json             # SPA rewrite fallback
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx             # orchestrates header + forms + table
    ├── index.css           # Tailwind + wuxia @theme tokens + .animate-soon
    ├── types/reforge.ts
    ├── lib/
    │   ├── constants.ts
    │   ├── id.ts           # shared uid() (crypto.randomUUID) for session/milestone ids
    │   ├── engine.ts       # pure logic (replay, pity accrual, cost, manual unlock, Node 5 gold, revert, luck, gold-luck distribution)
    │   ├── engine.test.ts  # Vitest unit tests
    │   ├── migrate.ts      # pure synthesizeUnlocks: insert unlock milestones into pre-manual (v1/v2/v3) inputs
    │   ├── migrate.test.ts # Vitest tests for synthesizeUnlocks (splitting, fidelity, idempotency)
    │   ├── storage.ts      # localStorage load/save (v4) + pure coerceState migration
    │   ├── storage.test.ts # Vitest tests for coerceState (migration, repair, fallbacks)
    │   ├── sessionIo.ts    # pure session JSON export/import (serialize, sanitize, parse)
    │   └── sessionIo.test.ts # Vitest tests for serialize/parse/sanitize
    ├── hooks/
    │   ├── useReforgeSession.ts
    │   └── useReforgeSession.test.ts  # tests the pure nextSessionName helper
    └── components/{SessionBar,CurrentStateBar,MilestoneTable,RollMilestoneForm,RevertMilestoneForm,Legend,GoldStats}.tsx
```

### 7.3 Persistence

A single key `wwm-reforge` holds `{ version: 4, sessions, activeSessionId }` — only each session's milestone inputs, since the tables are derived. `loadState`/`saveState` probe `localStorage` and fall back to an in-memory store when it is unavailable (e.g. private mode). On load, the pure `coerceState` validates the payload and:

- **migrates** the older single-session v2 shape (`{ version: 2, inputs }`) into one named `Session`, preserving an in-progress session (including legacy object-shaped `goldHits`);
- **migrates** a pre-manual-unlock v3 payload by synthesizing the missing `unlock` milestones per session (via `synthesizeUnlocks`), then repairing it;
- **repairs** a v4 payload (generates missing ids, defaults blank names, de-dupes ids, drops non-object entries, falls back to the first session when `activeSessionId` is dangling) without re-synthesizing;
- **resets** anything else (v1, an empty `sessions` array, unknown/missing version, or malformed JSON) to a single fresh default session.

`synthesizeUnlocks` ([lib/migrate.ts](../apps/reforge/src/lib/migrate.ts)) **splits** a roll batch at each legacy threshold (`LEGACY_UNLOCK_ROLLS`) it crosses and inserts the `unlock` there, so per-node pity stays numerically exact. The batch's original golds attach to its final roll piece; the only case it cannot represent is a node that both unlocked and golded on the exact same crossing roll (that single gold is dropped). It is idempotent (a no-op once explicit unlocks exist). The same helper migrates legacy (exportVersion 1) session files on import (see [lib/sessionIo.ts](../apps/reforge/src/lib/sessionIo.ts); current files are exportVersion 2).

This guarantees there is always at least one session with a resolvable `activeSessionId`. Note two accepted trade-offs: an older build that later reads a v4 payload will reset (forward-incompatible, same as any version mismatch); and because each tab persists the whole list, two tabs editing **different** sessions can overwrite each other (last write wins) — a known limitation for this version.

---

## 8. Deployment

The reforge app deploys to **Vercel** (the Boss Guide stays on GitHub Pages).

| Setting          | Value                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Root Directory   | `apps/reforge`                                                                                                      |
| Framework preset | Vite (auto-detected)                                                                                                |
| Build command    | `vite build` (via `pnpm build`)                                                                                     |
| Output directory | `dist`                                                                                                              |
| Install          | pnpm workspace install at repo root (keep "Include files outside the root directory" enabled)                       |
| Node version     | from root `package.json` `engines.node` = `24.x` (Vercel ignores `.nvmrc`); can also be set in the Vercel dashboard |
| Package manager  | detected from the root lockfile / `packageManager` field                                                            |

Auto-deploys on push to `main`; preview deploys on PRs. `base: '/'` because Vercel serves the app at its own domain root; [apps/reforge/vercel.json](../apps/reforge/vercel.json) adds an SPA rewrite (`/(.*)` → `/index.html`) for deep-link safety.

---

## 9. Implementation Phases

### Phase 1 — Foundation (implemented)

- [x] pnpm workspaces monorepo; boss guide moved to `apps/boss-guide`
- [x] Vite + React 18 + TS scaffold at `apps/reforge` with Tailwind 4 + wuxia palette
- [x] Domain types + pure `replay` engine (pity accrual, cost, unlock, Node 5 auto-gold, revert, luck)
- [x] `localStorage` (v2) persistence of milestone inputs with in-memory fallback
- [x] Milestone UI: CurrentStateBar, MilestoneTable, Roll/Revert forms; lock-via-chip
- [x] Cell highlighting: gold-luck colors + latest-row about-to-pop pulse
- [x] Edit / delete the latest milestone (re-replay)
- [x] Multiple named sessions (create / switch / rename / delete) via SessionBar, with v2 -> v3 migration
- [x] Vitest engine unit tests (plus `coerceState` migration and `nextSessionName` tests)
- [x] Vercel config; boss-guide GitHub Pages workflow updated for the monorepo

### Phase 2 — Polish

- [ ] Record cosmetic blue/purple tiers for the "current look" display
- [x] Export / import a session as JSON (backup, move devices) — per-session via SessionBar
- [x] Per-weapon unlocks handled via manual `unlock` milestones (the totals vary per skin, so they are no longer fixed constants)
- [ ] Settings panel to tweak soft-pity / cost constants per skin
- [ ] Optional "possible missed gold" hint when a node's pity passes hard pity (90)

### Phase 3 — Future

- [ ] Edit / delete any milestone (not just the latest)
- [ ] Pity-over-time visualization
- [ ] Reorder / duplicate sessions; per-session export / import

---

## 10. Out of Scope

- **Target-look progress and a strategy advisor** — this is a pure pity tracker. The strategy section in [docs/reforge.md](reforge.md) is reference-only.
- Roll simulation / RNG prediction (the player rolls in-game; the app only records outcomes).
- Accounts, sync, or a backend.

---

## 11. Open Questions

| #   | Question                                                      | Impact                                                                                                          |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Is Node 5 ever lockable / counted in roll cost? (Assumed no.) | If yes, a 4-locked stone cost is needed                                                                         |
| 2   | Are the soft-pity (~30-40) numbers stable across skins?       | Constants may need to be configurable per skin (unlock totals are already handled via manual unlock milestones) |

---

## 12. Legal / Copyright

_Where Winds Meet_ is developed by Everstone Studios. This is an **unofficial fan tool**, not affiliated with or endorsed by Everstone Studios. No game assets or data-mined files are included.
