# Where Winds Meet — Companion Apps

A pnpm workspaces monorepo of fan-made companion apps for *Where Winds Meet*.

| App | Path | What it does | Hosting |
|-----|------|--------------|---------|
| **Boss Guide** | [`apps/boss-guide`](apps/boss-guide) | Moveset encyclopedia — parry/dodge every boss attack with looping video guides | GitHub Pages — https://imouto1994.github.io/wwm/ |
| **Reforge Tracker** | [`apps/reforge`](apps/reforge) | Pity tracker for weapon-skin reforge sessions | Vercel |

## Repository layout

```
wwm/
├── apps/
│   ├── boss-guide/   # Next.js 15 + TinaCMS, static export to GitHub Pages
│   └── reforge/      # Vite + React SPA, deployed to Vercel
├── docs/             # SPEC.md (boss guide), reforge.md, reforge-app.md
├── biome.json        # shared lint/format config
└── pnpm-workspace.yaml
```

## Development

Requires Node 22 (see `.nvmrc`) and pnpm 10.

```bash
pnpm install        # install all workspace dependencies

pnpm dev:boss       # boss guide -> http://localhost:2110 (admin at /admin)
pnpm dev:reforge    # reforge tracker dev server
```

## Build

```bash
pnpm build:boss     # boss guide static export (out/) for GitHub Pages
pnpm build:reforge  # reforge SPA production build (dist/) for Vercel
pnpm build          # build every app
pnpm lint           # Biome across the workspace
```

The boss guide deploys to GitHub Pages via GitHub Actions on push to `main`. The reforge tracker deploys to Vercel automatically via its Git integration (Root Directory: `apps/reforge`).

## Specs

- Boss Guide: [docs/SPEC.md](docs/SPEC.md)
- Reforge Tracker: [docs/reforge-app.md](docs/reforge-app.md) (mechanics reference: [docs/reforge.md](docs/reforge.md))

## Disclaimer

Unofficial fan project. *Where Winds Meet* is developed by Everstone Studios. Not affiliated with or endorsed by Everstone Studios.
