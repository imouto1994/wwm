// Draws connectors between elements inside #frame by measuring them after
// layout, so moving a box never requires re-typing coordinates.
//
//   const { edge, path, label, rect, anchor } = createEdges();
//   edge(['a', 'right'], ['b', 'left'], { tone: 'green', label: 'publishes' });
//
// Anchors are [elementId, side, offset], where side is top | right | bottom |
// left and offset (0–1, default 0.5) is the position along that side.
// Tones map to shared.css variables: muted (default), green, blue, red,
// orange, purple.
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TONES = ['muted', 'green', 'blue', 'red', 'orange', 'purple'];

  function createEdges(frame = document.getElementById('frame')) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'edges');
    svg.innerHTML = `<defs>${TONES.map(
      (tone) =>
        `<marker id="arrow-${tone}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--${tone})" /></marker>`,
    ).join('')}</defs>`;
    frame.appendChild(svg);

    const origin = () => frame.getBoundingClientRect();

    const rect = (id) => {
      const o = origin();
      const r = document.getElementById(id).getBoundingClientRect();
      return {
        left: r.left - o.left,
        right: r.right - o.left,
        top: r.top - o.top,
        bottom: r.bottom - o.top,
        cx: (r.left + r.right) / 2 - o.left,
        cy: (r.top + r.bottom) / 2 - o.top,
        width: r.width,
        height: r.height,
      };
    };

    const anchor = (id, side, offset = 0.5) => {
      const r = rect(id);
      if (side === 'right') return [r.right, r.top + r.height * offset];
      if (side === 'left') return [r.left, r.top + r.height * offset];
      if (side === 'top') return [r.left + r.width * offset, r.top];
      return [r.left + r.width * offset, r.bottom];
    };

    const path = (d, { tone = 'muted', dashed = false, arrow = true, width } = {}) => {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', d);
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', `var(--${tone})`);
      el.setAttribute('stroke-width', String(width ?? (tone === 'muted' ? 1.5 : 2)));
      if (dashed) el.setAttribute('stroke-dasharray', '5 4');
      if (arrow) el.setAttribute('marker-end', `url(#arrow-${tone})`);
      svg.appendChild(el);
      return el;
    };

    const label = (x, y, html) => {
      const el = document.createElement('div');
      el.className = 'edge-label';
      el.innerHTML = html;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      frame.appendChild(el);
      return el;
    };

    const edge = (from, to, { label: text, labelAt = 0.5, dy = 0, ...style } = {}) => {
      const [x1, y1] = anchor(...from);
      const [x2, y2] = anchor(...to);
      const vertical = from[1] === 'top' || from[1] === 'bottom';
      const d = vertical
        ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
        : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
      const el = path(d, style);
      if (text) label(x1 + (x2 - x1) * labelAt, y1 + (y2 - y1) * labelAt + dy, text);
      return el;
    };

    return { anchor, edge, label, path, rect };
  }

  window.createEdges = createEdges;
})();
