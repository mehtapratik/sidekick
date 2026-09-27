const P = (d, stroke, w, o, dash, fill) => ({ d, stroke, w, o: (+o).toFixed(2), dash: dash || 'none', fill: fill || 'none' });
const C = (cx, cy, r, stroke, w, o, fill, dash) => ({ cx: (+cx).toFixed(1), cy: (+cy).toFixed(1), r: (+r).toFixed(1), stroke: stroke || 'none', w, o: (+o).toFixed(2), fill: fill || 'none', dash: dash || 'none' });
const R = (x, y, wd, ht, stroke, w, o, fill, rx) => ({ x: (+x).toFixed(1), y: (+y).toFixed(1), wd: (+wd).toFixed(1), ht: (+ht).toFixed(1), rx: rx || 0, stroke: stroke || 'none', w, o: (+o).toFixed(2), fill: fill || 'none' });

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed) {
  let s = seed;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- one generator per vault kind, plus the writings motif ----

// spec — Frame stack: nested rectangles with dimension ticks above.
function genFrameStack(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const n = 4 + Math.floor(rand() * 2);
  const cx = W / 2;
  const cy = 128;
  let w = W * 0.6, h = 156;
  for (let i = 0; i < n; i++) {
    const jx = (rand() - 0.5) * 6, jy = (rand() - 0.5) * 6;
    const x = cx - w / 2 + jx, y = cy - h / 2 + jy;
    const accent = i === 0;
    rects.push(R(x, y, w, h, accent ? pal.accent : pal.ink, accent ? 1.6 : 1, accent ? 0.75 : 0.22 + (n - i) * 0.08, 'none', 2));
    w *= 0.72; h *= 0.72;
  }
  const topY = cy - 156 / 2 - 14;
  const tickX0 = cx - W * 0.3, tickX1 = cx + W * 0.3;
  paths.push(P(`M ${tickX0.toFixed(1)} ${topY} L ${tickX0.toFixed(1)} ${topY + 8}`, pal.ink, 1, 0.4));
  paths.push(P(`M ${tickX1.toFixed(1)} ${topY} L ${tickX1.toFixed(1)} ${topY + 8}`, pal.ink, 1, 0.4));
  paths.push(P(`M ${tickX0.toFixed(1)} ${topY + 4} L ${tickX1.toFixed(1)} ${topY + 4}`, pal.ink, 1, 0.4));
  return { paths, circles, rects };
}

// prd — Requirement grid: 3×3 cells, one filled in accent.
function genRequirementGrid(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const cell = 46, gap = 12;
  const totalW = cell * 3 + gap * 2, totalH = cell * 3 + gap * 2;
  const x0 = W / 2 - totalW / 2, y0 = 120 - totalH / 2;
  const filled = Math.floor(rand() * 9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const x = x0 + c * (cell + gap), y = y0 + r * (cell + gap);
      if (idx === filled) rects.push(R(x, y, cell, cell, 'none', 0, 0.85, pal.accent, 2));
      else rects.push(R(x, y, cell, cell, pal.ink, 1, 0.28 + rand() * 0.15, 'none', 2));
    }
  }
  return { paths, circles, rects };
}

// decision — Branch: two paths from a node, one taken in accent, one crossed out.
function genBranch(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const cx = 66, cy = 120;
  const rightX = W - 66;
  const y1 = 66 + rand() * 24, y2 = 174 - rand() * 24;
  const chooseTop = rand() < 0.5;
  const mx = (cx + rightX) / 2;
  paths.push(P(`M ${cx} ${cy} C ${mx.toFixed(1)} ${cy}, ${mx.toFixed(1)} ${y1.toFixed(1)}, ${rightX} ${y1.toFixed(1)}`, chooseTop ? pal.accent : pal.ink, chooseTop ? 2.2 : 1.2, chooseTop ? 0.85 : 0.3));
  paths.push(P(`M ${cx} ${cy} C ${mx.toFixed(1)} ${cy}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${rightX} ${y2.toFixed(1)}`, !chooseTop ? pal.accent : pal.ink, !chooseTop ? 2.2 : 1.2, !chooseTop ? 0.85 : 0.3));
  circles.push(C(cx, cy, 5, 'none', 0, 0.8, pal.ink));
  circles.push(C(rightX, y1, chooseTop ? 5 : 4, 'none', 0, chooseTop ? 0.85 : 0.4, chooseTop ? pal.accent : pal.paper));
  circles.push(C(rightX, y2, !chooseTop ? 5 : 4, 'none', 0, !chooseTop ? 0.85 : 0.4, !chooseTop ? pal.accent : pal.paper));
  const ny = chooseTop ? y2 : y1;
  paths.push(P(`M ${(rightX - 6).toFixed(1)} ${(ny - 6).toFixed(1)} L ${(rightX + 6).toFixed(1)} ${(ny + 6).toFixed(1)} M ${(rightX - 6).toFixed(1)} ${(ny + 6).toFixed(1)} L ${(rightX + 6).toFixed(1)} ${(ny - 6).toFixed(1)}`, pal.ink, 1.4, 0.55));
  return { paths, circles, rects };
}

// plan — Gantt: staggered bars with dashed dependency links, one accent.
function genGantt(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  for (let x = 36; x <= W - 20; x += 33) paths.push(P(`M ${x} 20 L ${x} 222`, pal.ink, 1, 0.12));
  const bars = [];
  for (let i = 0; i < 6; i++) {
    const yc = 40 + i * 30, start = 36 + rand() * (W - 190), len = Math.min(45 + rand() * (W * 0.36), W - 24 - start);
    const col = rand() < 0.25 ? pal.accent : pal.ink;
    bars.push({ yc, start, end: start + len });
    rects.push(R(start, yc - 6.5, len, 13, 'none', 0, 0.22, col, 2));
    rects.push(R(start, yc - 6.5, len, 13, col, 1.1, 0.6, 'none', 2));
  }
  for (let i = 0; i < 5; i++) {
    if (rand() < 0.6) {
      const a = bars[i], b = bars[i + 1];
      paths.push(P(`M ${a.end.toFixed(1)} ${a.yc} L ${a.end.toFixed(1)} ${b.yc} L ${b.start.toFixed(1)} ${b.yc}`, pal.ink, 1, 0.4, '3 4'));
    }
  }
  for (let k = 0; k < 2; k++) {
    const b = bars[Math.floor(rand() * bars.length)];
    const mx = Math.min(b.end + 14, W - 20), my = b.yc;
    paths.push(P(`M ${mx.toFixed(1)} ${my - 6} L ${(mx + 6).toFixed(1)} ${my} L ${mx.toFixed(1)} ${my + 6} L ${(mx - 6).toFixed(1)} ${my} Z`, 'none', 0, 0.8, 'none', pal.accent));
  }
  return { paths, circles, rects };
}

// guidance — Radar: concentric circles with a sweep arc and scattered nodes.
function genRadar(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const cx = W / 2 + (rand() - 0.5) * W * 0.1, cy = 120 + (rand() - 0.5) * 18;
  const scale = W > 400 ? 1.15 : 1;
  const radii = [30, 60, 92].map((r) => r * scale * (0.85 + rand() * 0.3));
  radii.forEach((r) => circles.push(C(cx, cy, r, pal.ink, 1 + rand() * 0.6, 0.28 + rand() * 0.22, 'none', rand() < 0.4 ? '3 7' : 'none')));
  circles.push(C(cx, cy, 5 + rand() * 3, 'none', 0, 0.85, pal.accent));
  const nodes = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < nodes; i++) {
    const a = rand() * 6.28, r = radii[Math.floor(rand() * 3)];
    circles.push(C(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5 + rand() * 2, 'none', 0, 0.5 + rand() * 0.3, rand() < 0.4 ? pal.accent : pal.ink));
  }
  const a0 = rand() * 6.28, sweep = 0.7 + rand() * 1.1, r = radii[2];
  paths.push(P(`M ${(cx + Math.cos(a0) * r).toFixed(1)} ${(cy + Math.sin(a0) * r).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + Math.cos(a0 + sweep) * r).toFixed(1)} ${(cy + Math.sin(a0 + sweep) * r).toFixed(1)}`, pal.accent, 2.2, 0.75));
  return { paths, circles, rects };
}

// glossary — Lattice: node-link graph, one node ringed in accent.
function genLattice(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const n = 9 + Math.floor(rand() * 4);
  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ x: 40 + rand() * (W - 80), y: 26 + rand() * 188 });
  for (let i = 0; i < n; i++) {
    const links = 1 + Math.floor(rand() * 2);
    for (let l = 0; l < links; l++) {
      const j = Math.floor(rand() * n);
      if (j === i) continue;
      paths.push(P(`M ${nodes[i].x.toFixed(1)} ${nodes[i].y.toFixed(1)} L ${nodes[j].x.toFixed(1)} ${nodes[j].y.toFixed(1)}`, pal.ink, 1, 0.2));
    }
  }
  const ringed = Math.floor(rand() * n);
  nodes.forEach((nd, i) => {
    if (i === ringed) {
      circles.push(C(nd.x, nd.y, 7, pal.accent, 1.6, 0.9, 'none'));
      circles.push(C(nd.x, nd.y, 3, 'none', 0, 0.9, pal.accent));
    } else {
      circles.push(C(nd.x, nd.y, 3 + rand() * 1.5, 'none', 0, 0.45 + rand() * 0.3, pal.ink));
    }
  });
  return { paths, circles, rects };
}

// opportunity — Scatter: plotted points with one accent outlier inside brackets.
function genScatter(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  paths.push(P(`M 36 20 L 36 220`, pal.ink, 1, 0.25));
  paths.push(P(`M 36 220 L ${W - 20} 220`, pal.ink, 1, 0.25));
  const n = 22 + Math.floor(rand() * 10);
  const pts = [];
  for (let i = 0; i < n; i++) pts.push({ x: 46 + rand() * (W - 80), y: 40 + rand() * 160 });
  const outlier = { x: W - 50, y: 50 };
  pts.forEach((p) => circles.push(C(p.x, p.y, 2.2 + rand() * 1.3, 'none', 0, 0.32 + rand() * 0.3, pal.ink)));
  circles.push(C(outlier.x, outlier.y, 4, 'none', 0, 0.9, pal.accent));
  const bx0 = outlier.x - 12, bx1 = outlier.x + 12, by0 = outlier.y - 12, by1 = outlier.y + 12;
  paths.push(P(`M ${bx0 + 4} ${by0} L ${bx0} ${by0} L ${bx0} ${by1} L ${bx0 + 4} ${by1}`, pal.accent, 1.2, 0.7));
  paths.push(P(`M ${bx1 - 4} ${by0} L ${bx1} ${by0} L ${bx1} ${by1} L ${bx1 - 4} ${by1}`, pal.accent, 1.2, 0.7));
  return { paths, circles, rects };
}

// writings — Contour: 7–9 nested organic curves drifting right, one accent
// curve with a single accent node. No axes, no grid, no measurement marks.
function genContour(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const n = 7 + Math.floor(rand() * 3);
  const accentIdx = Math.floor(rand() * n);
  const steps = 6;
  for (let i = 0; i < n; i++) {
    const baseY = 20 + (i / (n - 1)) * 200;
    const amp = 12 + rand() * 22;
    const drift = 16 + rand() * 36;
    let d = `M 0 ${baseY.toFixed(1)}`;
    let lastX = 0, lastY = baseY;
    for (let s = 1; s <= steps; s++) {
      const x = (W / steps) * s;
      const y = baseY + Math.sin(s * 1.3 + i * 0.7) * amp + (x / W) * drift * 0.3;
      const cx1 = lastX + (x - lastX) / 2;
      d += ` Q ${cx1.toFixed(1)} ${lastY.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      lastX = x; lastY = y;
    }
    const isAccent = i === accentIdx;
    paths.push(P(d, isAccent ? pal.accent : pal.ink, isAccent ? 1.8 : 1.1, isAccent ? 0.8 : 0.2 + rand() * 0.18));
    if (isAccent) {
      const nodeX = W * (0.55 + rand() * 0.2);
      const step = nodeX / (W / steps);
      const nodeY = baseY + Math.sin(step * 1.3 + i * 0.7) * amp + (nodeX / W) * drift * 0.3;
      circles.push(C(nodeX, nodeY, 3.5, 'none', 0, 0.9, pal.accent));
    }
  }
  return { paths, circles, rects };
}

// Reserve motif — Margin: a ruled page with a vertical margin rule, one
// continuous line crossing it, and marginalia ticks. Not wired to any kind
// yet (§7.3) — kept so a future category can use it without a new motif.
function genMargin(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const marginX = W * 0.22;
  paths.push(P(`M ${marginX.toFixed(1)} 14 L ${marginX.toFixed(1)} 226`, pal.accent, 1, 0.5));
  for (let y = 30; y < 220; y += 16) paths.push(P(`M 20 ${y} L ${W - 20} ${y}`, pal.ink, 1, 0.12));
  let d = `M 20 120`;
  for (let x = 40; x < W - 20; x += 28) d += ` L ${x} ${(120 + (rand() - 0.5) * 40).toFixed(1)}`;
  paths.push(P(d, pal.ink, 1.3, 0.5));
  for (let i = 0; i < 5; i++) {
    const y = 40 + rand() * 160;
    paths.push(P(`M ${(marginX - 8).toFixed(1)} ${y.toFixed(1)} L ${(marginX - 2).toFixed(1)} ${y.toFixed(1)}`, pal.accent, 1, 0.4));
  }
  return { paths, circles, rects };
}

// Reserve motif — Drift: pen shading in short slanted strokes, density
// increasing toward the lower left, one accent stroke breaking rank.
// Not wired to any kind yet (§7.3).
function genDrift(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  let accentDrawn = false;
  for (let i = 0; i < 160; i++) {
    const x = rand() * W, y = 20 + rand() * 200;
    const densityBias = (1 - x / W) * (y / 220);
    if (rand() > densityBias + 0.15) continue;
    const len = 6 + rand() * 6;
    const isAccent = !accentDrawn && rand() < 0.03;
    if (isAccent) accentDrawn = true;
    paths.push(P(`M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x - len * 0.4).toFixed(1)} ${(y + len).toFixed(1)}`, isAccent ? pal.accent : pal.ink, isAccent ? 1.6 : 1, isAccent ? 0.85 : 0.22 + rand() * 0.2));
  }
  return { paths, circles, rects };
}

const TYPE_GEN = {
  'Frame stack': genFrameStack,
  'Requirement grid': genRequirementGrid,
  Branch: genBranch,
  Gantt: genGantt,
  Radar: genRadar,
  Lattice: genLattice,
  Scatter: genScatter,
  Contour: genContour,
  Margin: genMargin,
  Drift: genDrift,
};

/**
 * Build-time hero/thumbnail art for a document or writing.
 * @param {string} type - one of the TYPE_GEN keys above
 * @param {string} seed - stable identity (a doc's `id` frontmatter field, or a writing's slug); identical seed always draws identical art
 * @param {number} width - 640 for wide hero (viewBox 640x240), 320 for thumbnail (viewBox 320x240)
 * @param {{ink:string, accent:string, paper:string}} palette
 * @returns {string} standalone SVG markup string
 */
export function renderHeroSVG(type, seed, width, palette) {
  const gen = TYPE_GEN[type];
  if (!gen) throw new Error(`Unknown hero art type "${type}". Expected one of ${Object.keys(TYPE_GEN).join(', ')}`);
  const rand = mulberry32(hashStr(type + '::' + seed));
  const art = gen(rand, width, palette);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 240" aria-hidden="true">`;
  (art.rects || []).forEach((r) => { s += `<rect x="${r.x}" y="${r.y}" width="${r.wd}" height="${r.ht}" rx="${r.rx}" stroke="${r.stroke}" stroke-width="${r.w}" fill="${r.fill}" opacity="${r.o}"/>`; });
  (art.paths || []).forEach((p) => { s += `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.w}" stroke-dasharray="${p.dash}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.o}"/>`; });
  (art.circles || []).forEach((c) => { s += `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" stroke="${c.stroke}" stroke-width="${c.w}" stroke-dasharray="${c.dash}" fill="${c.fill}" opacity="${c.o}"/>`; });
  return s + '</svg>';
}

// Arkive palette: the oxblood / pink accent (the old gold is retired).
// `paper` matches --bg per mode, `ink` the --muted text tone.
export const HERO_ART_PALETTES = {
  light: { ink: '#5A5752', accent: '#8A1F43', paper: '#FFFFFF' },
  dark: { ink: '#A6A29B', accent: '#F08FB0', paper: '#0B0B0B' },
};
