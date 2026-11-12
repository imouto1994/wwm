---
name: visual-design
description: >-
  Designs technical visuals that explain better than Mermaid (for PR
  descriptions, canvases and chat), inventing the form that fits each piece of
  content rather than reusing a fixed template, and renders PR-description
  images as light and dark PNGs. Use when asked for a diagram, visualization or
  figure; when adding visuals to a PR description instead of Mermaid; or when
  building the figures inside a canvas.
disable-model-invocation: true
---

# Visual design

The point of a custom visual is that it can take whatever shape best explains the content. Mermaid's fixed shapes can't do that. So this skill sets only a few non-negotiables plus the mechanics for producing images. Everything else is a design decision for the content in front of you.

Past figures are examples to learn from, not templates to copy. A timeline, a map of data ownership, an annotated mock of a screen, a grid of cases or something new can all be right, depending on the question.

## Non-negotiables

1. **One question per visual.** The title states the answer, such as "Returning to the app: before vs after", not just the topic. If the answer needs "and", make two visuals.
2. **True to the source.** Every box, arrow, threshold and value matches the code or data. Label invented values in the subtitle or caption as illustrative (example values), schematic (shape only) or mock (UI approximation). Name the source of real values.
3. **Every visual choice means something.** Color, position, size, line style and weight each encode something. Explain any encoding that isn't obvious, with a legend or direct labels. Never rely on color alone.
4. **Legible where it lands.**
   - Text stays readable after GitHub scales the image down to the description width (roughly 11px at the source size, or larger).
   - Nothing is clipped or overlapping.
   - The visual works in both light and dark mode.
5. **The facts also live in text.** For PR images, add alt text that states the claim, and put a table or bullets with the same facts next to the image. Search, screen readers and text-only reviewers can't read pixels.

## Designing

- **Start from the reader's question,** then look at the shape of the content:
  - order over time;
  - flow between parts;
  - containment or ownership;
  - states and transitions;
  - cases mapped to outcomes;
  - quantities;
  - physical or UI layout.

  The shape suggests the form.
- **Sketch a few forms before building one.** Pick the one where the answer is visible at a glance. Push past box-and-arrow when it isn't the clearest choice.
- **Choose one focal point.** Decide what the eye should land on first. Everything else is context, and quieter.
- **Design for the medium.**
  - A PR description is a static image in a column about the width of the page.
  - A canvas sits in a narrow panel and can be interactive.
  - A chat visual should be small.
- **Look at the render and iterate.** Most of the quality comes from the second and third pass: spacing, label placement, what to cut.

## Forms to draw from

None of these is a rule. Combine them or invent something else when the content calls for it.

| Form | Good when |
| --- | --- |
| Timeline lanes on a shared axis | Before and after differ in *when* something happens |
| Side-by-side before/after | The difference is visible as a change in shape or copy |
| Architecture with the new parts emphasized | The question is "what did this PR add, and where does it sit?" |
| State or phase diagram | Behavior depends on conditions and transitions |
| Decision grid (cases × outcomes) | Several scenarios each lead to a different result |
| Small multiples | The same picture repeats across a few variants |
| Annotated UI mock or screenshot | The change is something a user sees |
| Swimlane sequence | Several actors exchange messages in order |
| Fan-out, before and after | The point is how many times something runs, or who calls what |
| Scale or number line with thresholds | Values sit relative to limits (strikes, timeouts, budgets) |
| Coverage or heat grid | Showing which combinations exist or are tested |
| Cadence lanes | Showing how often things fire |
| Interactive mock (canvas only) | Behavior depends on an input, such as width or a selection |

## Examples that worked, and why

- **PR #89943, `pr-visuals/89943-deribit-reconnect-toast-delay/`**
  - *Timeline:* reality, Before and After share one time axis, so the fix shows up as a visible gap.
  - *Architecture:* new pieces are tinted, and a bottom strip lists what was deliberately left unchanged, which answers "did you touch X?" up front.
  - *Phase rules:* each state shows the exact user-facing copy, and each transition states its condition.

  Each file renders its content from a small data array, so changing a value doesn't mean editing markup.
- **PR 81502 review canvas, `pr-81502-strike-filter-review-visualized.canvas.tsx`:**
  - mock menus make copy and APY changes concrete;
  - a bar chart with an "All rows" reference line exposes a strike option that filters nothing;
  - a before/after fan-out shows redundant work.

Borrow the reasoning, not the look. A new PR may need a completely different form.

## Color

- **Choose colors for the figure set and keep each hue's meaning consistent within one PR.** Say what they mean, with a legend or direct labels.
- **Reuse or change existing mappings as needed.** One mapping that worked (#89943) is:
  - green = new or healthy;
  - red = user-visible problem;
  - orange = transitional;
  - purple = escalated;
  - blue = the change's own rule or threshold;
  - grey = unchanged context.
- **Keep most of the figure neutral,** so color points at what matters.
- **Make colors theme-aware.** Define them as CSS variables with light and dark values. `pr-kit/shared.css` has a starting set; extend it freely. In canvases, use `useHostTheme()`.

## Outputs

### PR-description images

Any HTML, CSS, SVG or JS works: layouts, hand-drawn SVG, computed positions, generated rows. A page has only three requirements:

- an element with `id="frame"` wrapping the visual, which is what gets cropped;
- dark mode when the page loads with `?theme=dark`;
- no network requests, so renders are reproducible.

Steps:

1. **Folder.** Create `internal-documents/pr-visuals/<PR-number>-<short-slug>/`, with one HTML file per figure numbered in reading order. Copy in any kit files you use, so the folder renders on its own later.
2. **Starting points (optional).**
   - `pr-kit/shared.css`: theme tokens and a few generic pieces such as pills, boxes and a legend.
   - `pr-kit/edges.js`: `createEdges()` draws connectors between elements by measuring them.
   - `pr-kit/template.html`: a minimal page with the theme switch and `#frame`.
   - The #89943 pages are useful to read for techniques: a data-driven timeline, measured connectors, a dashed return path.
3. **Render** from `internal-documents`:

   ```sh
   node visual-design/pr-kit/render.js pr-visuals/<folder>            # all pages
   node visual-design/pr-kit/render.js pr-visuals/<folder> 2-arch     # one page
   ```

   This writes `out/<name>-light.png` and `out/<name>-dark.png` at 2x, cropped to `#frame`. It uses installed Google Chrome through `coinbase-www/node_modules/playwright-core`; set `PLAYWRIGHT_CORE` if that path is missing.
4. **Look at both PNGs** and fix whatever reads poorly.
5. **Upload.** Drag the PNGs into the PR description editor on GitHub to get `user-attachments` URLs.
6. **Embed each figure** near the text it explains, with a light/dark pair:

   ```html
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="https://coinbase.ghe.com/user-attachments/assets/<dark-id>">
     <img alt="Returning to the app: before vs after timeline" src="https://coinbase.ghe.com/user-attachments/assets/<light-id>">
   </picture>
   ```

7. **Add the same facts in text** next to each image (non-negotiable 5).
8. **Commit** the folder in `internal-documents`, including `out/`, with a message like `(doc): Add PR description diagrams for <topic>`. If the PR changes, regenerate the images from the HTML.

### Canvas figures

Design with this skill. For the mechanics, see [`../canvas-authoring/SKILL.md`](../canvas-authoring/SKILL.md): `rich()`, SDK components, connectors with `computeDAGLayout`, measured overflow, file rules.

### Chat visuals

Use the built-in `visualize` skill for the mechanics, with the non-negotiables above.

## When Mermaid is the better fit

- **Small flows that reviewers may want to edit** or comment on line by line.
- **Diagrams that must stay in sync with code in the same PR,** where re-rendering images is overhead.
- **Places where images can't be uploaded.**

## Review checklist

- [ ] The title answers one question; a first-time reader gets it in a few seconds
- [ ] The form fits the content's shape, and it isn't a default box-and-arrow by habit
- [ ] One clear focal point; context is quieter
- [ ] Every encoding means something and is explained; nothing relies on color alone
- [ ] Every element matches the source; invented values are labeled
- [ ] Legible at the size it is shown; nothing clipped or overlapping; both themes checked
- [ ] For PR images: alt text states the claim, and the same facts are in text nearby
