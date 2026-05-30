# WWM Boss Guide

The definitive moveset encyclopedia for *Where Winds Meet*. Learn to parry and dodge every boss attack with looping video guides.

**Live site**: https://imouto1994.github.io/wwm/

## Development

```bash
pnpm install
pnpm dev        # http://localhost:2110
```

Content is managed via TinaCMS — visit `http://localhost:2110/admin` to use the visual editor.

## Build for GitHub Pages

```bash
pnpm build:gh-pages
```

This produces a static `out/` directory deployed automatically via GitHub Actions on push to `main`.

## Tech Stack

- **Next.js 15** (App Router, static export)
- **TinaCMS** (Git-based headless CMS)
- **shadcn/ui** with Base UI primitives
- **Tailwind CSS 4**
- **TypeScript**

See [docs/SPEC.md](docs/SPEC.md) for the full product and technical specification.

## Disclaimer

This is an unofficial fan project. *Where Winds Meet* is developed by Everstone Studios. Not affiliated with or endorsed by Everstone Studios.
