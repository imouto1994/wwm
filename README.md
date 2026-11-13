# Where Winds Meet — Companion Apps

A pnpm workspaces monorepo of fan-made companion apps for *Where Winds Meet*.

| App | Path | What it does | Hosting |
|-----|------|--------------|---------|
| **Boss Guide** | [`apps/boss-guide`](apps/boss-guide) | Moveset encyclopedia — parry/dodge every boss attack with looping video guides | GitHub Pages — https://imouto1994.github.io/wwm/ |
| **Reforge Tracker** | [`apps/reforge`](apps/reforge) | Pity tracker for weapon-skin reforge sessions | Vercel |
| **Speedrun Randomizer** | [`apps/speedrun`](apps/speedrun) | Random loadouts for the guild speedrun event, shared by URL | Vercel |
| **PvP Tournament Tracker** | [`apps/pvp`](apps/pvp) | Live bracket for the guild 1v1v1 tournament, with a PIN-protected host page | Vercel + Upstash Redis |

## Repository layout

```
wwm/
├── apps/
│   ├── boss-guide/   # Next.js 15 + TinaCMS, static export to GitHub Pages
│   ├── reforge/      # Vite + React SPA, deployed to Vercel
│   ├── speedrun/     # Vite + React SPA, deployed to Vercel
│   └── pvp/          # Vite + React SPA + one Vercel Function (Upstash Redis)
├── docs/             # SPEC.md (boss guide), reforge.md, reforge-app.md, speedrun-app.md, pvp-app.md
├── scripts/easypoll/ # EasyPoll dashboard votes table -> JSON, for the PvP tracker's predictions
├── biome.json        # shared lint/format config
└── pnpm-workspace.yaml
```

## Development

Requires Node 22 (see `.nvmrc`) and pnpm 10.

```bash
pnpm install        # install all workspace dependencies

pnpm dev:boss       # boss guide -> http://localhost:2110 (admin at /admin)
pnpm dev:reforge    # reforge tracker dev server
pnpm dev:speedrun   # speedrun randomizer -> http://localhost:2130
pnpm dev:pvp        # PvP tracker -> http://localhost:2140 (host page at /host, local PIN "dev")

pnpm easypoll:json votes-table.html -o votes.json   # EasyPoll votes table HTML -> JSON for the PvP host page
```

To skip saving HTML, paste [`scripts/easypoll/easypoll-devtools.js`](scripts/easypoll/easypoll-devtools.js) into the Chrome DevTools console on the poll's votes page in the EasyPoll dashboard; it copies the same JSON to the clipboard.

## Build

```bash
pnpm build:boss     # boss guide static export (out/) for GitHub Pages
pnpm build:reforge  # reforge SPA production build (dist/) for Vercel
pnpm build:speedrun # speedrun SPA production build (dist/) for Vercel
pnpm build:pvp      # PvP tracker production build (dist/) for Vercel
pnpm build          # build every app
pnpm lint           # Biome across the workspace
```

The boss guide deploys to GitHub Pages via GitHub Actions on push to `main`. The Vercel apps each have their own Vercel project with the Root Directory set to the app (`apps/reforge`, `apps/speedrun`, `apps/pvp`) and deploy automatically via the Git integration. The PvP tracker also needs Upstash Redis connected from the Vercel Marketplace and a `HOST_PIN` environment variable (see [docs/pvp-app.md](docs/pvp-app.md#8-deployment)).

## Specs

- Boss Guide: [docs/SPEC.md](docs/SPEC.md)
- Reforge Tracker: [docs/reforge-app.md](docs/reforge-app.md) (mechanics reference: [docs/reforge.md](docs/reforge.md))
- Speedrun Randomizer: [docs/speedrun-app.md](docs/speedrun-app.md)
- PvP Tournament Tracker: [docs/pvp-app.md](docs/pvp-app.md) (production deploy runbook: [docs/pvp-deploy.md](docs/pvp-deploy.md))

## Disclaimer

Unofficial fan project. *Where Winds Meet* is developed by Everstone Studios. Not affiliated with or endorsed by Everstone Studios.
