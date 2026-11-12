---
name: canvas-authoring
description: >-
  Builds Cursor canvases (.canvas.tsx) that render correctly the first time:
  inline code and links that actually render, correct cursor/canvas SDK usage,
  reusable figure components, and a repeatable layout for PR reviews,
  investigations and walkthroughs. Use when asked to create, extend or fix a
  canvas, or when a canvas shows raw backticks, raw [text](url) links or
  overflowing layout. Pair with visual-design for what to draw.
disable-model-invocation: true
---

# Canvas authoring

This covers canvas **mechanics**: what has broken in practice and the patterns that work.

- **When to use a canvas**, and its general rules: the built-in canvas skill (`~/.cursor/skills-cursor/canvas/SKILL.md`).
- **What to draw:** [`../visual-design/SKILL.md`](../visual-design/SKILL.md). That covers the few non-negotiables, how to pick a form that fits the content, and the review checklist.

## The one rule that matters most

`Text` does **not** render markdown. The SDK docstring says backticks and `[text](url)` inside `Text` are "automatically parsed". In this setup they render literally. Table cells never go through `Text` at all.

Route every string that contains inline code or a link through `rich()`, and every table cell through `cell()`:

```tsx
import { Code, Link, Text } from 'cursor/canvas';

function rich(text: string) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
      return <Code key={index}>{part.slice(1, -1)}</Code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <Link key={index} href={link[2]}>
          {link[1]}
        </Link>
      );
    }
    return part;
  });
}

function cell(text: string) {
  return <Text size="small">{rich(text)}</Text>;
}

function cells(rows: string[][]) {
  return rows.map(row => row.map(cell));
}
```

Usage:

```tsx
<Text>{rich('`useTicker` re-renders on every publish. See [PR 81502](https://coinbase.ghe.com/frontend/coinbase-www/pull/81502).')}</Text>

<Table
  headers={['Guard', cell('Ladder (`useDualInvestmentCurrentPriceData`)'), 'Strike menu']}
  rows={cells([
    ['Price is positive and finite', 'Yes, `isPositiveFinite`', 'No, `lastPrice ?? markPrice`'],
  ])}
/>
```

The alternative, for hand-written prose, is explicit JSX, as in the SG prosumer canvas: `<Text>The vendor calls <Mono>onDisconnect</Mono> first…</Text>`, where `Mono` is a small styled `<span>`. Pick one approach per canvas. Use `rich()` whenever the content lives in string data.

### String pitfalls with `rich()`

- **Nested backticks break the split.** `` '`useTicker(`${symbol}-USD`)`' `` renders as fragments. Rephrase instead: `` '`useTicker` on `<symbol>-USD`' ``.
- **Quotes in JSX attributes.** A JSX attribute string cannot contain escaped quotes. Use an expression instead: ``where={'`role="menuitemradio"`'}``.
- **Template literals need escaping.** Inside a JS template literal, escape the backtick (`` \` ``) when you mean inline code.

## File rules

- **Path.** `~/.cursor/projects/<workspace>/canvases/<kebab-name>.canvas.tsx`. For the react-native workspace: `/Users/nhanbui/.cursor/projects/Users-nhanbui-Documents-coinbase-react-native/canvases/`. Write the file directly; do not `mkdir` or check that the directory exists.
- **One file.** Import only from `cursor/canvas`, default-export the top component, and embed all data inline. No `fetch`.
- **Exports.** Use only what exists. The full surface is in `~/.cursor/skills-cursor/canvas/sdk/*.d.ts`; read the file before using an unfamiliar component.
- **Children typing.** `ReactNode` is not exported. Use:

  ```tsx
  type Children = Parameters<typeof Stack>[0]['children'];
  ```

- **React hooks.** `useState`, `useRef`, `useEffect` and `useMemo` are re-exported from `cursor/canvas`. Use `useCanvasState(key, default)` only when state must survive reloads.
- **Type check.** Every write returns a `Canvas TypeScript check:` line. Treat it as the authoritative diagnostic and do not finish with errors.

## Component cheat sheet

Prop values below are from the SDK declarations; anything else is ignored or errors.

- **Layout**
  - `Stack` (gap) and `Row` (gap, align, justify, wrap).
  - `Grid` (`columns` as a number or a CSS string). Always use `minmax(0, 1fr)` tracks so content can't blow out a column.
  - `Divider`, `Spacer`.
- **Typography**
  - `H1` once at the top, `H2` for sections, `H3` for findings.
  - `Text`: tone `primary | secondary | tertiary | quaternary`, size `body | small`, weight `normal | medium | semibold | bold`.
  - `Code`, `Link`.
- **Surfaces**
  - `Card` (variant `default | borderless`, optional `collapsible`) with `CardHeader` and `CardBody`.
  - `CardHeader` takes plain text only, plus one small `trailing` item.
  - Do not nest cards, and do not wrap a `Table` in a `Card`.
- **Feedback**
  - `Callout` (tone `info | success | warning | danger | neutral`, optional `title`).
  - `Stat` (value, label, tone `success | danger | warning | info`).
  - `Pill` (`active`, size `sm | md`, `onClick`); its `tone` is ignored, so pills are always neutral.
- **Data**
  - `Table`: `headers`, `rows`, `columnAlign`, plus `rowTone` (`success | danger | warning | info | neutral`) for semantic row dots, and `stickyHeader` for long tables.
  - `DiffView` (`lines` of `{ type, content, lineNumber }`, plus `path` for syntax highlighting) and `DiffStats`.
- **Charts**
  - `BarChart`: `categories`, `series`, `horizontal`, `stacked`, `valueSuffix`, `referenceLines`, `height`.
  - `LineChart` and `PieChart` (`data`, `donut`).
- **Forms**
  - `Checkbox`, `Select`, `TextInput`, `TextArea`, `Toggle`, `IconButton`.
  - There is **no slider**: use a row of `Pill`s as presets.
- **Layout math:** `computeDAGLayout` (see Diagrams below).
- **IDE actions:** `useCanvasAction()` with `{ type: 'openFile', path }` opens a workspace file from a button. `Link` only opens URLs in the browser.

## Theme

Get colors only from `const t = useHostTheme()`. Never hardcode hex values.

- Text: `t.text.primary | secondary | tertiary | quaternary | link | onAccent`
- Surfaces: `t.bg.editor | chrome | elevated`
- Tints: `t.fill.primary | secondary | tertiary | quaternary`
- Borders: `t.stroke.primary | secondary | tertiary | focused`
- Accent: `t.accent.primary | control`
- Categories: `t.category.<gray|purple|green|yellow|cyan|pink|blue|orange|red>`
- Diff: `t.diff.insertedLine | removedLine | stripAdded | stripRemoved`

For custom SVG and mocks, use `t.category.<hue>` for colors that carry meaning. On `Stat`, `Callout`, charts and `rowTone`, use the semantic `tone` props (`success`, `danger`, `warning`, `info`). These colors follow the host theme automatically.

## Workflow

```
- [ ] 1. Read the built-in canvas skill; skim the SDK .d.ts for every component you plan to use
- [ ] 2. Gather source data; verify every number, line reference and claim against the code or fixture
- [ ] 3. Design each figure with ../visual-design/SKILL.md: one question per figure, in whatever form fits the content
- [ ] 4. Write the file; route all markdown through rich() / cell() / cells()
- [ ] 5. Fix until "Canvas TypeScript check: no errors"
- [ ] 6. Search the file for backticks; each must sit inside a string passed to rich()/cell()/cells(), a regex, or an escaped template literal
- [ ] 7. Run the visual-design review checklist, then the canvas checks below
- [ ] 8. In chat, link the canvas with its absolute path: [Title](/Users/.../canvases/name.canvas.tsx)
```

## Building blocks for common forms

These SDK pieces cover some common forms. When none fits, draw the form directly: raw SVG, absolutely positioned `div`s and computed layouts all work inside a canvas.

| Form | Canvas building block |
| --- | --- |
| Bar chart with a limit | `BarChart` with `horizontal` and `referenceLines` |
| Side-by-side mocks | Mock menus or rows in a `Grid` with `minmax(0, 1fr)` columns |
| Decision table | `Table` with `rowTone` on the problem rows, cells via `cells()` |
| Fan-out or data-flow diagram | `FlowDiagram` (below), before and after |
| Numbered steps | `Steps`-style rows with a muted unreachable step |
| Cadence lanes | Hand-written SVG with `viewBox` and `width="100%"`, labeled schematic |
| Layout behavior | `Pill` width presets plus measured overflow (below) |
| The fix | `DiffView` with real line numbers |

Two rules specific to canvases:

- **No empty states.** Never render placeholder rows, "No data" messages or zeroed charts; omit the section instead.
- **Corrections go near the top.** If an earlier statement turns out wrong while you build the canvas, add a short `Callout tone="info" title="Corrections"`. State each correction plainly in a sentence or two.

## Reusable pieces

### Figure wrapper

```tsx
function Figure({ title, caption, children }: { title: string; caption?: string; children?: Children }) {
  return (
    <Stack gap={8}>
      <Text size="small" weight="semibold">{title}</Text>
      {children}
      {caption ? <Text size="small" tone="tertiary">{rich(caption)}</Text> : null}
    </Stack>
  );
}
```

### Finding block (reviews)

```tsx
function Finding({ id, severity, title, where, what, why, fix, stacked = false, children }: {
  id: string; severity: string; title: string; where: string;
  what: string[]; why: string[]; fix: string[]; stacked?: boolean; children?: Children;
}) {
  const block = (label: string, lines: string[]) => (
    <Stack gap={4}>
      <Text size="small" weight="semibold" tone="secondary">{label}</Text>
      {lines.map(line => <Text key={line}>{rich(line)}</Text>)}
    </Stack>
  );
  const explanation = (
    <Stack gap={12}>{block('What happens', what)}{block('Why it matters', why)}{block('Fix', fix)}</Stack>
  );
  return (
    <Stack gap={12}>
      <Row gap={6} align="center" wrap>
        <Pill size="sm" active>{id}</Pill>
        <Pill size="sm">{severity}</Pill>
      </Row>
      <H3>{title}</H3>
      <Text size="small" tone="tertiary">{rich(where)}</Text>
      {stacked ? (
        <Stack gap={16}>{explanation}<Stack gap={16}>{children}</Stack></Stack>
      ) : (
        <Grid columns="minmax(0, 1fr) minmax(0, 1.2fr)" gap={24} align="start">
          {explanation}
          <Stack gap={16}>{children}</Stack>
        </Grid>
      )}
    </Stack>
  );
}
```

Use `stacked` when the visual is wide: three mock menus, a four-column table, or an interactive mock.

### DAG diagram

```tsx
type FlowNode = { id: string; label: string; sub?: string; emphasis?: boolean };

function FlowDiagram({ title, nodes, edges, direction, nodeWidth = 220 }: {
  title: string; nodes: FlowNode[]; edges: Array<{ from: string; to: string }>;
  direction: 'horizontal' | 'vertical'; nodeWidth?: number;
}) {
  const t = useHostTheme();
  const nodeHeight = 46;
  const layout = computeDAGLayout({
    nodes: nodes.map(n => ({ id: n.id })), edges, direction, nodeWidth, nodeHeight,
    rankGap: 56, nodeGap: 12, padding: 4,
  });
  const byId = new Map(nodes.map(n => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} width="100%" role="img" aria-label={title}
      style={{ maxWidth: layout.width, display: 'block' }}>
      {layout.edges.map(e => {
        const mx = (e.sourceX + e.targetX) / 2;
        const my = (e.sourceY + e.targetY) / 2;
        const d = direction === 'horizontal'
          ? `M ${e.sourceX} ${e.sourceY} C ${mx} ${e.sourceY}, ${mx} ${e.targetY}, ${e.targetX} ${e.targetY}`
          : `M ${e.sourceX} ${e.sourceY} C ${e.sourceX} ${my}, ${e.targetX} ${my}, ${e.targetX} ${e.targetY}`;
        return <path key={`${e.from}-${e.to}`} d={d} fill="none" stroke={t.stroke.primary} />;
      })}
      {layout.nodes.map(p => {
        const n = byId.get(p.id);
        if (!n) return null;
        return (
          <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
            <rect width={nodeWidth} height={nodeHeight} rx={6}
              fill={n.emphasis ? t.fill.secondary : t.bg.elevated}
              stroke={n.emphasis ? t.accent.primary : t.stroke.secondary} />
            <text x={10} y={n.sub ? 19 : 28} fontSize={12} fill={t.text.primary}>{n.label}</text>
            {n.sub ? <text x={10} y={35} fontSize={11} fill={t.text.tertiary}>{n.sub}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}
```

`computeDAGLayout` returns node top-left `x`/`y`, edge anchor points and total `width`/`height`. SVG text does not wrap, so keep labels to about 30 characters for a 190–240px node. In narrow columns, `width="100%"` scales the whole diagram, text included, so avoid placing more than two diagrams side by side.

### Measured overflow (interactive layout mocks)

```tsx
const rowRef = useRef<HTMLDivElement>(null);
const [overflow, setOverflow] = useState(0);
useEffect(() => {
  const el = rowRef.current;
  if (el) setOverflow(Math.max(0, el.scrollWidth - el.clientWidth));
}, [width, wrap]);
```

Put the measured row inside a fixed-`width` dashed box wrapped in `overflowX: 'auto'`. Label the result as a mock, because canvas fonts differ from the product's fonts.

## One review layout that worked

`pr-81502-strike-filter-review-visualized.canvas.tsx` used this layout. It's a reasonable starting point for PR reviews; change it to fit the content.

1. `H1` title, then one `Text` line with the PR link via `rich()`.
2. A `Row` of 2–4 `Stat`s: counts by severity, comments to delete, missing tests.
3. A corrections `Callout`, only if something earlier was wrong.
4. One `H2` per severity group. One `Finding` per point, each with its own visual, and a `Divider` between findings.
5. Closing tables, each with `rowTone`: comments (keep or delete), test coverage (covered, missing, codified), and nits.

## Layout pitfalls

- **Mock rows overflowing their box.** `whiteSpace: 'nowrap'` on mock menu labels overflowed narrow grid columns. Let labels wrap: `flexWrap: 'wrap'` and `minWidth: 0` on the label container. Keep only values `nowrap`.
- **Three-column grids get tight** beside the chat. Fine for short mock menus; use `stacked` findings or two columns for anything wider.
- **Duplicate keys.** Key list items by stable content, not by index, when items can repeat.
- **Pill tone is ignored.** Show severity with a separate neutral `Pill` and a semantic `Stat`, `Callout` or `rowTone`.
- **Buttons never stretch.** For full-width choice rows, use custom rows or `Pill`s.

## Canvas checks

Color meaning, labeling and data integrity are covered by the visual-design checklist. The built-in canvas skill adds a few host constraints:

- No gradients, box shadows or emojis.
  - Plain glyphs such as `✓`, `▾`, `↗` and `≥` are fine.
- Not a wall of identical cards.
- No decorative borders.
- Text size at or below `H1` (24px).

Beyond those, check that the canvas holds up at the narrow width beside the chat.

## Reference canvases

These live in the react-native workspace `canvases/` directory:

- `pr-81502-strike-filter-review-visualized.canvas.tsx`: the review layout above, plus `rich()`/`cell()`, mock menus, a DAG before/after, an interactive overflow mock, and a schematic SVG.
- `p2-dual-deribit-stack-walkthrough.canvas.tsx`: `rich()` and `cell()` over string data, a custom grid-graph and sequence-diagram layout, and bullets.
- `sg-prosumer-rat-responsiveness-investigation.canvas.tsx`: an investigation layout with explicit `<Mono>`/`<Link>` JSX, a `CodeBlock`, and a causal chain.
