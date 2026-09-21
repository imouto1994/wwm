# Speedrun Loadout Randomizer - Agent Guide

Guidelines for working on the **Speedrun Loadout Randomizer** (`apps/speedrun`), one of three apps in this monorepo (the others are `apps/boss-guide` and `apps/reforge`). Read this before changing anything here. The full spec is [docs/speedrun-app.md](../../docs/speedrun-app.md).

## What this app is (and is not)

- A tool for the guild's speedrun event: the host randomizes 2 different martial arts and 8 unique mystic skills, then shares the exact result via a URL.
- A client-side SPA: Vite + React 18 + TypeScript + Tailwind 4. **No backend, no router, no CMS, no localStorage.** The URL's query string *is* the persistence layer - there is nothing else to persist.
- It does **not** randomize the boss (chosen and communicated by the host outside the app), does not keep a history of past randomizations, and does not support rerolling a single slot. Do not add these without checking with the team first - they were deliberately left out of the MVP (see [docs/speedrun-app.md](../../docs/speedrun-app.md) "Out of scope").

## The one mental model that matters

There is no session/state to manage beyond one `LoadoutResult`. A page load is either:

- **Host mode** - the URL had no valid loadout at mount time. Clicking Randomize computes one, stores it in React state, and mirrors it into the address bar (`history.replaceState`, not `pushState` - rerolling for the next participant should not pile up browser-history entries).
- **Viewer mode** - the URL already decoded a valid loadout at mount time. Read-only: no Randomize button.

Mode is decided **once, at mount**, and never re-evaluated - see `initLoadoutState` in [src/hooks/useLoadout.ts](src/hooks/useLoadout.ts). Do not make mode reactive to later state changes; that would let a host's reroll accidentally flip a viewer's tab into edit mode, or vice versa.

```
URL query string --decodeLoadout()--> LoadoutResult | null --isViewerMode?--> read-only vs. Randomize-enabled UI
Randomize click  --randomizeLoadout()--> LoadoutResult --encodeLoadout()--> history.replaceState
```

## Architecture

- `src/types/randomizer.ts` - domain types. `WeaponEntry.isDps` is currently **not** used by the randomizer (both weapon slots draw from the full pool) - it's kept on the data model in case a future event wants a DPS-only slot again. `SkillEntry` has no category (one flat pool). `LoadoutResult` is just 3 ids/id-lists - the only thing ever persisted (into the URL).
- `src/data/weapons.ts`, `src/data/skills.ts` - the two hand-maintained pools. **This is the primary place you'll edit to add content.** Append an entry with a unique `id`, then drop its image into `public/images/weapons/` or `public/images/skills/` (any format works - PNG, JPEG, WEBP, SVG - the `image` field is just a path rendered through a plain `<img>`). Never reuse or repurpose an `id` that a live event's shared links might still reference.
- `src/data/data.test.ts` - guards the pools: unique ids, non-empty fields, at least 2 weapons, at least 8 skills. Keep this green - it is the safety net for careless data edits. Does **not** require any DPS-flagged weapon (see above).
- `src/lib/randomize.ts` - **pure, framework-free** `randomizeLoadout(weapons, skills, rng?)`. Weapon 1 and weapon 2 are both drawn uniformly from the full weapons pool, with weapon 2 excluding weapon 1's id (must differ); 8 unique skills via a partial Fisher-Yates shuffle. Takes an injectable `rng` for deterministic tests. Throws a descriptive error on too-small pools - callers must catch and show it, not let it crash the UI. See the "Future: reintroduce a DPS-only slot" comment inline for how to bring that back if a later event wants it.
- `src/lib/shareLink.ts` - **pure** `encodeLoadout`/`decodeLoadout` (against `URLSearchParams`) and `buildShareUrl` (takes `origin`/`pathname` as plain args, not `window`, to stay unit-testable). `decodeLoadout` returns `null` - never throws - for anything that doesn't fully validate (missing param, wrong skill count, duplicate/unknown id, `w1 === w2`), so a stale/edited/garbage URL just falls back to the empty host state.
- `src/hooks/useLoadout.ts` - owns `{ loadout, isViewerMode }` plus `randomize()` and the derived `shareUrl`. The only piece of React state in the app.
- `src/components/` - `EntryCard` (generic weapon/skill card, fixed 1:1 image frame, no badges/tags), `ImageWithFallback` (falls back to an initials box on a 404/decode failure, regardless of image format), `LoadoutResult` (2 weapon cards + an 8-up skill grid, skills sorted back to their pool order for a stable display), `RandomizeButton` and `ShareLink` (both host-mode only).

## Invariants that are easy to get wrong

- **Weapon 2 must differ from weapon 1** - `randomizeLoadout` excludes weapon 1's id from weapon 2's candidate pool. Don't drop this exclusion.
- **`isDps` is currently inert** - not used by the randomizer, and not surfaced anywhere in the UI (no badge/tag). Don't reintroduce a DPS filter or a "DPS" badge without an explicit product decision - both were removed on purpose. The flag stays on the data model only so it's cheap to bring either back later.
- **Skill display order != draw order.** `LoadoutResult` re-sorts the drawn skill ids back into `SKILLS`'s pool order before rendering. The randomness is in *which* 8 are drawn, not in the on-screen order.
- **`isViewerMode` is set once and never flips.** Don't derive it from `loadout !== null` at render time - that would make a host's own freshly-randomized result look like "viewer mode" too.
- **`decodeLoadout` must return `null`, never throw**, for any invalid input - it runs on every page load, including ones with a hand-edited or stale URL.
- **`history.replaceState`, not `pushState`** in `useLoadout.randomize` - a host rerolling repeatedly for each participant should not fill up back-button history.
- **Images are format-agnostic.** Never assume `.svg`/`.png`/etc. in code that touches the `image` field - it is just a path to whatever file exists.

## Adding or changing behavior

1. Implement logic in `randomize.ts` or `shareLink.ts` as pure functions; wire UI through `useLoadout`.
2. Add/extend Vitest tests alongside the logic you write (this repo expects tests - see `randomize.test.ts`, `shareLink.test.ts`, `data.test.ts` for the existing coverage style).
3. Keep detailed top-level and inline comments explaining the *why* (a repo-wide rule).
4. **Update [docs/speedrun-app.md](../../docs/speedrun-app.md)** whenever behavior, data model, or UI changes.
5. If you change the URL's query param shape, keep `decodeLoadout` backward-tolerant where practical (old links may still be shared/bookmarked from before your change), or accept that old links will fall back to the empty host state - just don't let them throw or render garbage.

## Commands (run from repo root)

- Dev: `pnpm dev:speedrun` (http://localhost:2130)
- Build + typecheck: `pnpm --filter wwm-speedrun build` (`tsc --noEmit && vite build`)
- Tests: `pnpm --filter wwm-speedrun test` (Vitest)
- Lint/format: `pnpm lint` (Biome, workspace-wide). Always finish with build + test + lint green.

## Conventions

- Imports use the `@/` alias to `src/`. Biome formats with single quotes and moves imports above top-of-file comments - that reordering is expected, do not fight it.
- Theme: reuse the wuxia tokens in [src/index.css](src/index.css) (`bg`, `surface`, `gold`, `border`, etc.), shared with `apps/reforge` and `apps/boss-guide`. Mobile-first.
- TypeScript is strict with `noUnusedLocals`/`noUnusedParameters`; keep imports and params clean.

## Deployment

This app deploys to **Vercel** (Root Directory `apps/speedrun`, Vite preset, output `dist/`), with `base: '/'`, mirroring `apps/reforge`. The Node version comes from the **root** `package.json` `engines.node` (currently `24.x`; mirrored in `apps/speedrun/package.json`). Creating the actual Vercel project is a manual dashboard step, not something in this repo.
