# Where Winds Meet — Boss Moveset Encyclopedia

## Product & Technical Specification

---

## 1. Overview

### 1.1 Vision

A community-driven web app that serves as the definitive reference for **every boss encounter** in *Where Winds Meet*. For each boss, the app showcases their complete moveset — with short looping WebM clips demonstrating how to **parry or dodge** every attack — displayed inline like high-quality GIFs with accompanying descriptions.

### 1.2 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| 1 | Help players learn boss mechanics visually | Time-on-page > 2 min per boss |
| 2 | Provide a CMS-driven workflow so content editors can add bosses and moves without code changes | New boss added in < 15 minutes via TinaCMS |
| 3 | Deliver a fast, mobile-friendly experience | Lighthouse performance > 90 |
| 4 | Build a foundation that can expand to other game content | Clean data model with room for new collections |

### 1.3 Target Audience

- **Primary**: Players struggling with specific boss fights who want visual guides.
- **Secondary**: Content creators / wiki editors who want a structured, easy-to-update reference.
- **Tertiary**: Speedrunners and challenge players optimizing parry timing.

---

## 2. Information Architecture

```
Home (/)
├── Bosses (/bosses)
│   └── Boss Detail (/bosses/:slug)
│       ├── Overview section (lore, location, difficulty, thumbnail)
│       ├── Moveset list
│       │   └── Move Entry
│       │       ├── WebM clip (autoplay, loop, muted — like a GIF)
│       │       ├── Title
│       │       └── Description
├── About (/about)
└── Admin (/admin)  ← TinaCMS editing UI
```

### 2.1 Page Descriptions

| Page | Purpose |
|------|---------|
| **Home** | Hero banner, featured / recently updated bosses, quick search |
| **Bosses index** | Filterable grid of all bosses (by region, difficulty) |
| **Boss detail** | The core page — full moveset breakdown with looping WebM clips and descriptions |
| **About** | Credits, contribution guidelines, disclaimers |
| **Admin** | TinaCMS visual editor (auto-generated at `/admin`) |

---

## 3. Data Model — TinaCMS Collections

All content lives in `content/` as Markdown/JSON files tracked in Git.

### 3.1 Collection: `boss`

**Path**: `content/bosses`
**Format**: `mdx`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` (isTitle) | Yes | Display name of the boss (e.g. "Luo Yiren") |
| `thumbnail` | `image` | Yes | Boss portrait or screenshot |
| `region` | `string` (options) | Yes | Game region / chapter (e.g. "Minzhou", "Langya") |
| `difficulty` | `string` (options) | Yes | "Easy", "Medium", "Hard", "Very Hard" |
| `description` | `rich-text` | No | Lore blurb and general overview (shown in the boss hero section) |
| `moves` | `object` (list) | Yes | Array of Move objects (see 3.2) |

> **Note on slugs**: TinaCMS uses the filename (e.g. `luo-yiren.mdx`) as the implicit slug via `document._sys.filename`. There is no separate `slug` field — the URL `/bosses/luo-yiren` is derived from the filename automatically.

> **Note on MDX body vs structured fields**: The collection uses `mdx` format, which gives each file a rich-text body (`_body`). However, we intentionally do **not** use the MDX body for content. All boss data lives in the structured frontmatter fields (`description`, `moves[].description`). This keeps the content fully queryable via the Tina GraphQL API and avoids splitting information across two places.

### 3.2 Embedded Object: `Move` (within `boss.moves`)

Each move represents a single attack/counter entry in a boss's moveset.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Name of the move (e.g. "Sweeping Crane Kick — Parry") |
| `videoFile` | `image` | Yes | WebM clip stored in the repo via TinaCMS media. Despite the name, the `image` field type is TinaCMS's only built-in file picker — and its media manager supports `video/*` (including `.webm`) by default. No special configuration needed. |
| `description` | `rich-text` | No | Explanation of the move: what the boss does, how to counter it, timing tips, inputs, etc. Rendered via `<TinaMarkdown>` component. |

### 3.3 Collection: `global`

Inherited from the tina-nextjs-starter. Extended to include:

| Field | Type | Description |
|-------|------|-------------|
| `siteName` | `string` | Site title (default: "WWM Boss Guide") |
| `siteDescription` | `string` | SEO meta description |
| `logo` | `image` | Site logo |
| `defaultHeroImage` | `image` | Fallback hero image |
| `socialLinks` | `object` (list) | Discord, GitHub, YouTube links |
| `footer` | `rich-text` | Footer content / disclaimer |

---

## 4. UI / UX Design

### 4.1 Design Principles

1. **Dark-first theme** — matches the game's wuxia aesthetic; a muted ink-wash palette with accent gold highlights.
2. **Video-forward** — WebM clips autoplay muted and loop continuously, behaving like high-quality GIFs. No play button needed.
3. **Scannable** — players mid-fight need to find a specific move fast. Strong visual hierarchy, searchable, and filterable.
4. **Mobile-first** — many players will have their phone next to them while gaming; the layout must work well at 375px.
5. **Accessible** — all clips have text descriptions alongside them; color is never the only indicator.

### 4.2 Color Palette (Tailwind tokens)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#0f0f0f` | Page background |
| `bg-surface` | `#1a1a2e` | Card / panel backgrounds |
| `bg-surface-hover` | `#242442` | Card hover state |
| `text-primary` | `#e8e6e3` | Primary text |
| `text-secondary` | `#9b9b9b` | Secondary / muted text |
| `accent-gold` | `#c9a84c` | Headings, important highlights (wuxia gold) |
| `accent-red` | `#c94c4c` | Difficulty "Very Hard", warning accents |
| `border-subtle` | `#2a2a3e` | Card borders, dividers |

### 4.3 Key Components

#### Boss Card (bosses index)
- Thumbnail image (16:9 aspect ratio)
- Boss name overlay (bottom, semi-transparent gradient)
- Difficulty badge (top-right corner, color-coded)
- Boss type pill (top-left)
- Region text (below name)
- Hover: slight scale-up + glow border

#### Move Entry (boss detail page)
- WebM clip displayed inline — `<video autoplay muted loop playsinline>` — behaves like a GIF
- Move title displayed prominently above or beside the clip
- Description (rich text) below the clip — covers what the attack looks like, how to counter, timing tips, input hints, etc.
- Clips use a consistent aspect ratio (16:9) with rounded corners and a subtle border
- On mobile: full-width clip, title and description stacked below
- On desktop: clip on one side, title + description on the other (alternating layout or consistent left-clip/right-text)

#### Empty & Error States
- **No bosses yet** (initial setup): Boss index shows a message like "No bosses added yet. Head to /admin to add your first boss."
- **Boss with zero moves**: Boss detail page shows the boss overview and a message "No moves documented yet."
- **Missing boss (404)**: `/bosses/nonexistent-slug` returns Next.js `notFound()` — render a themed 404 page with a link back to the boss index.
- **Broken video clip**: If a WebM file path is missing or fails to load, show a styled placeholder (e.g. a dark panel with "Clip unavailable") instead of a broken video element. Use the `<video>` `onerror` event to detect.

### 4.4 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px (sm) | Single column; full-width clips with title + description stacked below |
| 640–1024px (md) | Two-column boss grid; move entries with wider clips |
| > 1024px (lg) | Three-column boss grid; move entries with clip on one side, text on the other |

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 15.x |
| React | React | 18.x |
| CMS | TinaCMS | 3.x |
| UI Components | shadcn/ui with Base UI primitives | latest |
| Styling | Tailwind CSS | 4.x |
| Animations | Motion (Framer Motion) | 12.x |
| Video | Native `<video>` element (WebM, autoplay loop) | N/A |
| Icons | Lucide React + react-icons | latest |
| Language | TypeScript | 5.x |
| Package Manager | pnpm | latest |

### 5.2 Project Structure

```
wwm/
├── app/
│   ├── layout.tsx                   # Root layout: dark theme, global data fetch, header + footer
│   ├── page.tsx                     # Home page (boss grid, hero tagline)
│   ├── not-found.tsx                # Themed 404 page
│   ├── bosses/
│   │   ├── page.tsx                 # Boss index (server component, passes data to BossGrid)
│   │   └── [slug]/
│   │       └── page.tsx             # Boss detail (SSG via generateStaticParams)
│   ├── about/
│   │   └── page.tsx                 # About page with disclaimer
│   └── admin/                       # TinaCMS admin (auto-generated at build)
├── components/
│   ├── layout/
│   │   ├── header.tsx               # Sticky top nav ("use client" for mobile menu toggle)
│   │   └── footer.tsx               # Fan disclaimer, social links, TinaCMS attribution
│   ├── boss/
│   │   ├── boss-card.tsx            # Boss grid card with thumbnail overlay + badges
│   │   ├── boss-grid.tsx            # "use client" filterable grid (search, region, difficulty, type)
│   │   ├── boss-hero.tsx            # Boss detail page hero section
│   │   ├── move-entry.tsx           # Single move: WebM clip + title + TinaMarkdown description
│   │   ├── move-list.tsx            # List of MoveEntry components with separators
│   │   └── video-clip.tsx           # "use client" <video> with IntersectionObserver play/pause
│   ├── ui/
│   │   ├── button.tsx               # shadcn/ui Button (Base UI primitive)
│   │   └── card.tsx                 # shadcn/ui Card (Base UI primitive)
│   └── error-boundary.tsx           # React error boundary (kept from starter)
├── content/
│   ├── bosses/                      # Boss MDX files (TinaCMS managed)
│   │   ├── luo-yiren.mdx
│   │   ├── jade-faced-reaper.mdx
│   │   └── ...
│   └── global/                      # Site-wide settings (singleton JSON)
│       └── index.json
├── tina/
│   ├── config.tsx                   # TinaCMS config: Boss + Global collections, WebM media accept
│   ├── collection/
│   │   ├── boss.ts                  # Boss collection schema (name, thumbnail, moves[], etc.)
│   │   └── global.ts                # Global settings schema (siteName, socialLinks, footer)
│   └── __generated__/               # Auto-generated client, types, GraphQL (not committed)
├── lib/
│   └── utils.ts                     # cn() helper + richTextToPlainText() for SEO
├── public/
│   └── uploads/                     # TinaCMS media uploads (committed to Git)
│       ├── bosses/                  # Boss thumbnail images
│       └── moves/                   # Move WebM clips
├── styles.css                       # Tailwind + shadcn theme tokens + wuxia dark palette
├── components.json                  # shadcn/ui config (base-mira style, Base UI primitives)
├── package.json
├── tsconfig.json
└── next.config.ts
```

### 5.3 Routing

| Route | Source | Rendering |
|-------|--------|-----------|
| `/` | `app/page.tsx` | SSG (static) |
| `/bosses` | `app/bosses/page.tsx` | SSG (static, fetches all bosses at build time) |
| `/bosses/[slug]` | `app/bosses/[slug]/page.tsx` | SSG with `generateStaticParams` |
| `/about` | `app/about/page.tsx` | SSG (static) |
| `/admin` | Auto-generated by TinaCMS | Client-side |

### 5.4 Data Flow

```
┌──────────────┐     build time      ┌─────────────────┐
│  content/    │  ──────────────────► │ Tina GraphQL API │
│  bosses/*.mdx│                      │  (local or cloud)│
└──────────────┘                      └────────┬────────┘
                                               │
                                    GraphQL queries
                                               │
                                      ┌────────▼────────┐
                                      │  Next.js Pages   │
                                      │  (SSG at build)  │
                                      └────────┬────────┘
                                               │
                                         Static HTML
                                               │
                                      ┌────────▼────────┐
                                      │   CDN / Vercel   │
                                      │   (serves site)  │
                                      └─────────────────┘

┌──────────────┐     live editing     ┌─────────────────┐
│  /admin UI   │  ◄──────────────────►│  Tina Cloud API  │
│  (browser)   │                      │  (saves to Git)  │
└──────────────┘                      └─────────────────┘
```

### 5.5 Video Strategy — WebM in Repo

All move clips are stored directly in the Git repository as **WebM files** under `public/uploads/moves/`. This keeps everything self-contained, version-controlled, and free of external dependencies.

**Why WebM?**
- VP9/VP8 codec provides excellent compression — a 5–10s clip at 720p is typically 200–500 KB
- Universally supported across modern browsers (Chrome, Firefox, Edge, Safari 14.1+)
- Much smaller than GIFs with better quality; effectively "GIF-like" behavior via `<video autoplay muted loop playsinline>`
- No JavaScript player library needed — native `<video>` element handles everything

**iOS / Safari autoplay constraints:**
iOS Safari allows autoplay only when the video is both `muted` and has `playsinline`. Our clips meet both requirements. However:
- **Low Power Mode** on iOS may still block autoplay — the IntersectionObserver `.play()` call may be rejected. The `video-clip.tsx` component should catch the rejected Promise silently (browsers return a Promise from `.play()`).
- **Very old iOS (< 14.1)** may not support WebM at all. See browser fallback section below.

**Guidelines for clip preparation:**
- **Duration**: 3–15 seconds per clip (short, focused on one move)
- **Resolution**: 720p (1280×720) max — balances quality and file size
- **Codec**: VP9 preferred, VP8 as fallback
- **File size target**: < 1 MB per clip (keep repo manageable)
- **Naming convention**: `{boss-slug}--{move-slug}.webm` (e.g. `luo-yiren--sweeping-crane-kick.webm`)

**Rendering in the UI:**
```html
<video autoplay muted loop playsinline preload="none">
  <source src="/uploads/moves/luo-yiren--sweeping-crane-kick.webm" type="video/webm" />
</video>
```

**Viewport-aware playback (critical for performance):**
A boss page with 10–20 moves means 10–20 `<video>` elements. Playing all simultaneously wastes bandwidth and battery. The `video-clip.tsx` component must use **IntersectionObserver** to:
- Set `preload="none"` on all clips initially — don't download anything offscreen
- When a clip scrolls into the viewport: call `.play()` and let the browser start buffering
- When a clip scrolls out of the viewport: call `.pause()` to free resources
- Threshold: ~50% visibility before triggering play (avoids flicker at edges)

**Browser fallback:**
WebM (VP9) is supported in all modern browsers: Chrome, Firefox, Edge, and Safari 14.1+ (macOS Big Sur / iOS 14.1, released Oct 2020). For the rare user on older Safari:
- The `<video>` element will simply show nothing (no crash).
- We do **not** provide MP4 fallback — the added storage/complexity isn't worth it for < 1% of traffic. The text description beside each clip serves as the fallback experience.
- If this ever becomes an issue, MP4 files can be added as a second `<source>` inside the same `<video>` element without any schema changes (just upload an `.mp4` alongside the `.webm`).

**Repo size considerations:**
- With ~50 bosses × ~10 moves = ~500 clips × ~500 KB avg = **~250 MB** total
- Acceptable for a Git repo; Git LFS can be added later if needed
- TinaCMS media manager handles uploads to `public/uploads/` natively

### 5.6 Rich-Text Rendering

TinaCMS `rich-text` fields store content as an AST (abstract syntax tree) in the frontmatter, not raw Markdown. To render these fields, use the `<TinaMarkdown>` component from the `tinacms` package:

```tsx
import { TinaMarkdown } from "tinacms/dist/rich-text";

<TinaMarkdown content={move.description} />
```

This is required for the boss `description` field and each move's `description` field. Forgetting `<TinaMarkdown>` and trying to render the raw data will produce JSON gibberish in the UI.

### 5.7 Search & Filtering (Client-Side)

Since the dataset is bounded (estimated < 50 bosses, < 500 total moves), client-side filtering is sufficient.

- **Boss index page**: Filter by `region`, `difficulty`. Text search on `name`.
- **Boss detail page**: Text search across move `title` and `description`.
- Implementation: Simple React state + `useMemo` for filtered results. No external search library needed.

---

## 6. TinaCMS Schema Implementation

The `tina/config.tsx` media configuration should explicitly include `video/webm` to make intent clear (it's allowed by default under `video/*`, but being explicit avoids surprises):

```typescript
media: {
  tina: {
    publicFolder: "public",
    mediaRoot: "uploads",
  },
  accept: ["image/*", "video/webm"],
},
```

### 6.1 Boss Collection (`tina/collection/boss.ts`)

```typescript
import type { Collection } from "tinacms";

const Boss: Collection = {
  label: "Bosses",
  name: "boss",
  path: "content/bosses",
  format: "mdx",
  ui: {
    router: ({ document }) => `/bosses/${document._sys.filename}`,
  },
  fields: [
    {
      type: "string",
      label: "Boss Name",
      name: "name",
      isTitle: true,
      required: true,
    },
    {
      type: "image",
      label: "Thumbnail",
      name: "thumbnail",
      required: true,
    },
    {
      type: "string",
      label: "Region",
      name: "region",
      required: true,
      options: [
        "Minzhou",
        "Langya",
        "Jiangnan",
        "Northern Desert",
        "Eastern Sea",
        "Other",
      ],
    },
    {
      type: "string",
      label: "Location",
      name: "location",
    },
    {
      type: "string",
      label: "Difficulty",
      name: "difficulty",
      required: true,
      options: ["Easy", "Medium", "Hard", "Very Hard"],
    },
    {
      type: "string",
      label: "Boss Type",
      name: "bossType",
      required: true,
      options: [
        "Story Boss",
        "World Boss",
        "Side Boss",
        "Hidden Boss",
      ],
    },
    {
      type: "rich-text",
      label: "Description",
      name: "description",
    },
    {
      type: "object",
      label: "Moves",
      name: "moves",
      list: true,
      ui: {
        itemProps: (item) => ({
          label: item?.title || "New Move",
        }),
      },
      fields: [
        {
          type: "string",
          label: "Title",
          name: "title",
          required: true,
        },
        {
          type: "image",
          label: "Video Clip (WebM)",
          name: "videoFile",
          required: true,
        },
        {
          type: "rich-text",
          label: "Description",
          name: "description",
        },
      ],
    },
    {
      type: "string",
      label: "Tags",
      name: "tags",
      list: true,
    },
  ],
};

export default Boss;
```

---

## 7. Sample Content (for development)

Below is a **simplified representation** of what a content file contains. In practice, TinaCMS `rich-text` fields are stored as a JSON AST in the frontmatter (not raw text). Editors never see this directly — they use the visual editor at `/admin`.

**`content/bosses/luo-yiren.mdx`** (conceptual view):

```yaml
---
name: "Luo Yiren"
thumbnail: "/uploads/bosses/luo-yiren.jpg"
region: "Minzhou"
location: "Bamboo Valley"
difficulty: "Hard"
bossType: "Story Boss"
description:  # ← rich-text AST (managed by TinaCMS visual editor)
  # "Guardian of Bamboo Valley, a master swordswoman known for her
  #  deceptive grace. Her second phase introduces phantom blade attacks
  #  that require rapid parry-dodge transitions."
moves:
  - title: "Sweeping Crane Kick — Parry"
    videoFile: "/uploads/moves/luo-yiren--sweeping-crane-kick.webm"
    description:  # ← rich-text AST
      # "She spins to the left with a blue glow on her trailing foot.
      #  Parry with LMB (keyboard) or L1 (controller) just as the foot
      #  glows. Tight timing window. Appears in Phase 1 and Phase 2."
  - title: "Phantom Blade Flurry — Dodge then Parry"
    videoFile: "/uploads/moves/luo-yiren--phantom-blade-flurry.webm"
    description:  # ← rich-text AST
      # "Rapid afterimages appear as she draws two phantom blades.
      #  Parry the first hit, then dodge sideways for hits 2–4.
      #  Very tight window. Phase 2 only."
  - title: "Rising Gale Thrust — Jump"
    videoFile: "/uploads/moves/luo-yiren--rising-gale-thrust.webm"
    description:  # ← rich-text AST
      # "A quick upward thrust preceded by a crouching wind-up.
      #  Jump to avoid it entirely. Forgiving timing."
tags: ["wuxia-swordsman", "multi-phase", "fast-combos"]
---
```

> **Note**: The MDX body is intentionally left empty. All content lives in the structured frontmatter fields so it remains fully queryable via the Tina GraphQL API. Editors use the `/admin` visual editor — they never edit this YAML directly.

---

## 8. Key User Flows

### 8.1 Player Looking Up a Specific Move

```
1. Land on Home → type boss name in search bar
2. Click boss card → Boss Detail page
3. Scroll through moveset — clips autoplay as they enter the viewport
4. Read the title and description alongside each looping clip
5. Scroll to next move, repeat
```

### 8.2 Content Editor Adding a New Boss

```
1. Navigate to /admin
2. Log in via Tina Cloud
3. Click "Bosses" → "Create New"
4. Fill in boss fields (name, thumbnail, region, etc.)
5. Add moves one by one via the "Moves" list field
   - Upload a WebM clip via TinaCMS media manager
   - Enter the move title
   - Write the description (rich text — can include timing tips, inputs, etc.)
6. Click "Save" → TinaCMS commits to Git
7. CI/CD rebuilds and deploys the site
```

---

## 9. Performance & SEO

### 9.1 Performance Strategy

| Concern | Approach |
|---------|----------|
| Images | Use Next.js `<Image>` with `placeholder="blur"`, WebP format, responsive sizes |
| Videos | Native `<video>` with `preload="none"` + IntersectionObserver to autoplay only when visible; no JS player overhead |
| Bundle | Code-split per route via Next.js App Router; no heavy video player library to load |
| Fonts | System font stack or a single variable font; avoid layout shift |
| CSS | Tailwind — only ships used classes; purged at build |

### 9.2 SEO

| Element | Implementation |
|---------|----------------|
| Title tags | `<boss name> Moveset Guide — WWM Boss Encyclopedia` |
| Meta description | Auto-generated from `boss.description` (first 155 chars) |
| Open Graph | Boss thumbnail, name, difficulty |
| Structured data | `VideoObject` JSON-LD for each move clip |
| Sitemap | Auto-generated via `next-sitemap` or manual `sitemap.ts` |

---

## 10. Deployment

| Target | Details |
|--------|---------|
| **Hosting** | GitHub Pages (static export at `https://imouto1994.github.io/wwm/`) |
| **Build** | `pnpm build:gh-pages` — TinaCMS local content build + Next.js static export (`output: 'export'`) |
| **CI/CD** | Push to `main` → GitHub Actions workflow builds and deploys to Pages automatically |
| **CMS editing** | Local only via `pnpm dev` → `/admin`. The deployed site's admin UI is view-only (no Tina Cloud backend). Content changes are committed to Git and trigger a rebuild. |

### 10.1 Static Export Configuration

The site is built as a fully static export (no Node.js server). Key config in `next.config.ts`:

| Setting | Value | Purpose |
|---------|-------|---------|
| `output` | `'export'` | Produces a static `out/` directory |
| `basePath` | From `NEXT_PUBLIC_BASE_PATH` env var (`/wwm`) | Prefixes all routes for GitHub Pages subpath hosting |
| `trailingSlash` | `true` | Generates `/bosses/luo-yiren/index.html` for clean URLs |
| `images.unoptimized` | `true` | Disables Image Optimization API (requires a server) |

### 10.2 Base Path Handling

GitHub Pages serves the site at `https://imouto1994.github.io/wwm/`, requiring a `/wwm` prefix on all URLs. The `NEXT_PUBLIC_BASE_PATH` env var is the single source of truth:

- **`next.config.ts`** reads it to set `basePath` (auto-prefixes `<Link>` and `<Image>`)
- **`video-clip.tsx`** reads it to manually prefix `<video><source src>` (Next.js does NOT auto-prefix raw HTML elements)
- **Local dev**: env var is not set → no prefix → `localhost:2110/` works normally
- **Production build**: `build:gh-pages` script sets `NEXT_PUBLIC_BASE_PATH=/wwm`

### 10.3 GitHub Actions Workflow

`.github/workflows/deploy.yml` triggers on push to `main`:
1. Checks out the repo
2. Installs pnpm + Node.js (from `.nvmrc`)
3. Runs `pnpm build:gh-pages` — this sets `NEXT_PUBLIC_BASE_PATH=/wwm` and placeholder Tina Cloud credentials, then runs `tinacms build --content=local --skip-cloud-checks -c "next build"` which starts a local TinaCMS data layer, builds the admin UI, and produces a static `out/` directory
4. Uploads `out/` as a Pages artifact
5. Deploys via `actions/deploy-pages` (no `gh-pages` branch needed)

**Prerequisites**: Enable GitHub Pages in repo Settings → Pages → Source: "GitHub Actions".

### 10.4 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BASE_PATH` | Build only | Set by `build:gh-pages` to `/wwm`. Controls basePath in `next.config.ts` and video src prefixing. |
| `NEXT_PUBLIC_TINA_CLIENT_ID` | Tina Cloud only | Not needed for static export with local content |
| `TINA_TOKEN` | Tina Cloud only | Not needed for static export with local content |
| `NEXT_PUBLIC_TINA_BRANCH` | Tina Cloud only | Not needed for static export with local content |

---

## 11. Implementation Phases

### Phase 1 — Foundation (MVP) ✅ Implemented

- [x] Scaffold project from `tina-nextjs-starter`
- [x] Strip starter demo content and unused dependencies (react-player, mermaid, shiki, Radix UI, Headless UI)
- [x] Re-initialize shadcn/ui with Base UI primitives (preset `b2Cin4wNM`, Mira style)
- [x] Define `boss` collection schema in TinaCMS
- [x] Define simplified `global` collection (siteName, socialLinks, footer)
- [x] Build Boss index page (BossGrid client component with region/difficulty/type filters + text search)
- [x] Build Boss detail page (BossHero + MoveList with SSG via generateStaticParams)
- [x] Build Move Entry component (VideoClip with IntersectionObserver + TinaMarkdown description)
- [x] Dark wuxia theme (ink-wash palette with gold accent in .dark CSS block)
- [x] Root layout with global data fetch, header, footer merged into app/layout.tsx
- [x] About page with fan project disclaimer and contribution guide
- [x] Custom 404 page
- [x] SEO metadata (generateMetadata with richTextToPlainText utility)
- [x] Add 2 sample bosses with placeholder WebM clips
- [x] Configure static export for GitHub Pages (output: 'export', basePath, trailingSlash)
- [x] GitHub Actions CI/CD workflow (.github/workflows/deploy.yml)
- [x] basePath handling for video clips (NEXT_PUBLIC_BASE_PATH env var)

### Phase 2 — Polish

- [ ] Enhanced home page hero with featured bosses
- [ ] Difficulty visual indicators (beyond badge colors)
- [ ] Mobile UX optimization and testing
- [ ] SEO: OG images, sitemap.ts
- [ ] Replace placeholder content with real gameplay clips

### Phase 3 — Community & Expansion

- [ ] Contribution guide for community editors
- [ ] Move-level deep links (`/bosses/luo-yiren#sweeping-crane-kick-parry`)
- [ ] Boss comparison feature
- [ ] PWA support for offline reference
- [ ] Analytics integration

---

## 12. Open Questions

| # | Question | Impact |
|---|----------|--------|
| 1 | Are boss regions finalized, or do we need a CMS-managed list? | Schema design — `options` vs `reference` collection |
| 2 | Do we want user accounts for bookmarking / progress tracking? | Auth layer, DB requirement — out of TinaCMS scope |
| 3 | Do we need localization (Chinese, Japanese, Korean)? | Affects content model, routing, and editorial workflow |
| 4 | Should we adopt Git LFS from the start for the WebM files? | Repo clone speed; can be added later if needed |

---

## 13. Legal / Copyright

*Where Winds Meet* is developed by Everstone Studios. This web app is an **unofficial fan project** and is not affiliated with or endorsed by Everstone Studios.

- The About page must include a visible disclaimer stating this is a fan-made resource.
- Boss names and in-game terminology are used for informational/educational purposes under fair use.
- Video clips are original gameplay recordings, not ripped game assets.
- No game source code, data-mined assets, or proprietary files should be included.
- If the developer or publisher requests takedown, comply promptly.

---

## 14. Implementation Notes

Key technical decisions made during the Phase 1 build:

| Decision | Rationale |
|----------|-----------|
| **Base UI instead of Radix UI** | shadcn/ui re-initialized with `base-mira` style. Single `@base-ui/react` dependency replaces multiple `@radix-ui/*` packages. Actively maintained by MUI team. |
| **shadcn preset `b2Cin4wNM`** | Mira style (dense), gray base, green theme, Inter font, Lucide icons. Dark mode `.dark` CSS variables customized to wuxia ink-wash palette. |
| **Header/footer merged into `app/layout.tsx`** | Eliminated the separate `components/layout/layout.tsx` wrapper. Root layout is a server component that fetches global data — pages inherit header/footer automatically without manual wrapping. |
| **`richTextToPlainText()` in `lib/utils.ts`** | TinaCMS rich-text is a JSON AST. This utility recursively extracts text nodes for SEO meta descriptions. |
| **BossGrid as `"use client"` component** | Server/client split for the boss index page. Server component fetches data, passes to BossGrid which manages filter state with `useState` + `useMemo`. |
| **VideoClip IntersectionObserver** | Clips use `preload="none"` and only play when >=50% visible. `.play()` Promise rejections caught silently for iOS Low Power Mode. |
| **No `react-player`, no external video host** | All clips are WebM files in the repo, rendered via native `<video>` element. Zero JS video library overhead. |
| **Dark-only theme** | `<html className="dark">` always set. `.dark` CSS variables hold the wuxia palette. `:root` light values kept as unused fallback. No theme toggle. |
| **Hard-coded nav links** | "Bosses" and "About" are fixed routes. CMS-editable nav deferred to Phase 2. |
| **GitHub Pages static export** | `output: 'export'` produces a static `out/` directory. `NEXT_PUBLIC_BASE_PATH=/wwm` is the single source of truth for basePath in both `next.config.ts` and `video-clip.tsx`. ISR/revalidation removed — all data baked in at build time. |
| **`--content=local` is required for build** | `tinacms build --content=local` starts a local GraphQL data layer that reads content from the filesystem. Without it, the generated client tries to query Tina Cloud (401 with placeholder credentials). Placeholder env vars for `NEXT_PUBLIC_TINA_CLIENT_ID`, `TINA_TOKEN`, and `NEXT_PUBLIC_TINA_BRANCH` are still required because `tina/config.tsx` references them. |
| **Admin is view-only on deployed site** | The deployed static site's admin UI loads but cannot save edits (no Tina Cloud backend). Content edits done locally via `pnpm dev` or by editing MDX files in Git. Push to `main` triggers rebuild. |

---

## 15. Out of Scope (for now)

- User authentication / accounts
- Comments or community discussion (use Discord instead)
- Build/equipment recommendation engine
- Real-time multiplayer move sharing
- AI-generated parry timing analysis
- Native mobile app
