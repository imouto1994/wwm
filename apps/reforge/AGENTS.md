# Reforge Pity Tracker - Agent Guide

Guidelines for working on the **Reforge Pity Tracker** (`apps/reforge`), one of two apps in this monorepo (the other is `apps/boss-guide`). Read this before changing anything here. The full spec is [docs/reforge-app.md](../../docs/reforge-app.md); the game mechanics reference is [docs/reforge.md](../../docs/reforge.md).

## What this app is (and is not)

- A **milestone-based, pure pity tracker** for Where Winds Meet weapon reforge. The player records a milestone when a node turns gold, is locked/unlocked, or is reverted - NOT every roll.
- A client-side SPA: Vite + React 18 + TypeScript + Tailwind 4. **No backend, no router, no CMS.** State lives in `localStorage`.
- It is intentionally **not** a roll simulator, RNG predictor, or strategy advisor, and it does **not** track gold variant/set or target looks. Do not reintroduce these - prior iterations deliberately removed them.

## The one mental model that matters

The single source of truth is an ordered `MilestoneInput[]` **per session**. The entire per-node table is **derived** by `replay(inputs)` in [src/lib/engine.ts](src/lib/engine.ts). Only the inputs are persisted (the app keeps many named sessions plus the active id - see `storage.ts`); never store computed state (pity, stones, snapshots).

```
MilestoneInput[]  --replay()-->  Milestone[] (snapshots + running totals)  -->  table
```

Consequences: editing/deleting a milestone is just a list mutation + re-replay; the "current state" is the last milestone's snapshot (or `createInitialNodes()` when empty).

## Architecture

- `src/types/reforge.ts` - domain types. `goldHits` is `NodeId[]` (no variant); `Session` wraps a named `MilestoneInput[]`; `PersistedState` is v3 (`sessions` + `activeSessionId`).
- `src/lib/constants.ts` - all game numbers. Change tuning here, never inline.
- `src/lib/id.ts` - shared `uid()` (`crypto.randomUUID`) for session/milestone ids; used by storage and the hook.
- `src/lib/engine.ts` - **pure, framework-free** logic. Put business logic here, not in components. (Session-agnostic: it replays one `MilestoneInput[]` and is unaffected by multi-session.)
- `src/lib/storage.ts` - localStorage load/save, version-gated (v3), with in-memory fallback. Pure exported `coerceState` migrates v2 and repairs/validates v3.
- `src/hooks/useReforgeSession.ts` - `useReducer` over `{ sessions, activeSessionId }`; milestone actions target the active session, session actions create/switch/rename/delete; derives `replay` via `useMemo`; persists.
- `src/components/` - `SessionBar`, `CurrentStateBar`, `MilestoneTable`, `RollMilestoneForm`, `RevertMilestoneForm`.

## Invariants that are easy to get wrong

- **Unlock off-by-one**: a node enabled at threshold `T` first accrues pity at roll `T+1`. Use the `Math.max(prevCum, T)` clamp in the accrual formula; do not "fix" it.
- **Locks are their own milestones**, so lock config is constant within a roll segment - that is why cost (`rolls * cost(lockedCount)`) and pity accrual are simple. Keep lock changes as separate milestones.
- **Re-rolling an UNLOCKED gold clears its gold** (gambled away); a **LOCKED** gold is frozen and keeps its star. See the `accruing > 0` branch in `applyRoll`.
- **Node 5** is auto-gold once `cum >= 100`: never rolled, never locked, not counted in cost, no pity. Always special-case it.
- **`goldPity`** records pity-at-gold per node for the gold-luck cell color, because the snapshot pity is 0 after a gold. Keep it derived in replay.
- **Revert** zeroes all pity but keeps `enabled` (permanent unlocks), `cumulativeRolls`, and `cumulativeStones` (no stone refund).
- **Only the latest milestone** can be edited or deleted.
- **Cell highlighting**: gold-luck colors (`GOLD_LUCK` 30/50 thresholds) show on the row a node golded; the "about to pop" pulse (`isSoon`, `SOON_PITY`) shows on the **latest row only** and on the current-state chips, and honors `prefers-reduced-motion`.

## Adding or changing behavior

1. Implement logic in `engine.ts` as a pure function; wire UI through `useReforgeSession`.
2. Add/extend Vitest tests in `src/lib/engine.test.ts` (this repo expects tests for logic you write). Cover boundaries (unlock crossings, locks, gold/re-roll, revert, Node 5).
3. Keep detailed top-level and inline comments explaining the *why* (a repo-wide rule).
4. **Update [docs/reforge-app.md](../../docs/reforge-app.md)** whenever behavior, data model, or UI changes.
5. If you change the persisted schema, bump/guard `version` in `storage.ts` and add a migration in the pure `coerceState` (see the v2->v3 path and `normalizeInputs`) so existing sessions are not silently corrupted. Keep `coerceState` pure and covered by `storage.test.ts`.

## Commands (run from repo root)

- Dev: `pnpm dev:reforge` (http://localhost:2120)
- Build + typecheck: `pnpm --filter wwm-reforge build` (`tsc --noEmit && vite build`)
- Tests: `pnpm --filter wwm-reforge test` (Vitest)
- Lint/format: `pnpm lint` (Biome, workspace-wide). Always finish with build + test + lint green.

## Conventions

- Imports use the `@/` alias to `src/`. Biome formats with single quotes and moves imports above top-of-file comments - that reordering is expected, do not fight it.
- Theme: reuse the wuxia tokens in [src/index.css](src/index.css) (`bg`, `surface`, `gold`, tier colors). Mobile-first.
- TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`; keep imports and params clean.

## Deployment

This app deploys to **Vercel** (Root Directory `apps/reforge`, Vite preset, output `dist/`), with `base: '/'`. The Node version comes from the **root** `package.json` `engines.node` (`.nvmrc` is ignored by Vercel). The boss guide - not this app - is the one on GitHub Pages; do not couple the two.
