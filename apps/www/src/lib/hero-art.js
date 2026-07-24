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

// ---- one generator per article TYPE (not category) ----

function genEssay(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  paths.push(P(`M 26 22 L 26 220`, pal.ochre, 1, 0.3));
  rects.push(R(38, 30, 26, 30, pal.ink, 1.2, 0.5, 'none', 2));
  const lines = [];
  let y = 36, paraFirst = true;
  while (y < 220) {
    if (!paraFirst && rand() < 0.2) { y += 12; paraFirst = true; continue; }
    const nearCap = y < 62;
    const x0 = 38 + (nearCap ? 34 : 0) + (paraFirst && !nearCap ? 14 : 0);
    const len = (W - 48 - x0) * (0.55 + rand() * 0.45);
    lines.push({ y, x0, len });
    paraFirst = false; y += 15;
  }
  lines.forEach(L => {
    let d = `M ${L.x0} ${L.y}`;
    for (let x = L.x0 + 30; x < L.x0 + L.len; x += 30) d += ` L ${x} ${(L.y + (rand() - 0.5) * 2.4).toFixed(1)}`;
    d += ` L ${(L.x0 + L.len).toFixed(1)} ${(L.y + (rand() - 0.5) * 2).toFixed(1)}`;
    paths.push(P(d, pal.ink, 1.4, 0.38 + rand() * 0.24));
  });
  const u = lines[Math.floor(rand() * lines.length)];
  let ud = `M ${u.x0} ${u.y + 6}`;
  for (let x = u.x0 + 12; x < u.x0 + Math.min(u.len, 100); x += 12) ud += ` Q ${x - 6} ${u.y + 3} ${x} ${u.y + 7}`;
  paths.push(P(ud, pal.accent, 1.3, 0.65));
  return { paths, circles, rects };
}

function genBlog(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  paths.push(P(`M 26 22 L 26 220`, pal.ochre, 1, 0.3));
  const blocks = 1 + Math.floor(rand() * 2);
  const blockYs = [];
  let by = 60 + rand() * 40;
  for (let b = 0; b < blocks; b++) { blockYs.push(by); by += 70 + rand() * 40; }
  let y = 34;
  while (y < 220) {
    const inBlock = blockYs.some(b => y > b - 8 && y < b + 54);
    if (inBlock) { y += 15; continue; }
    if (rand() < 0.15) { y += 12; continue; }
    const x0 = 38 + (rand() < 0.2 ? 14 : 0);
    const len = (W - 48 - x0) * (0.55 + rand() * 0.45);
    let d = `M ${x0} ${y}`;
    for (let x = x0 + 30; x < x0 + len; x += 30) d += ` L ${x} ${(y + (rand() - 0.5) * 2.4).toFixed(1)}`;
    paths.push(P(d, pal.ink, 1.4, 0.38 + rand() * 0.24));
    y += 15;
  }
  blockYs.forEach(byy => {
    if (byy > 190) return;
    const bw = W - 86;
    rects.push(R(38, byy, bw, 48, pal.ink, 1, 0.3, 'none', 3));
    rects.push(R(38, byy, bw, 48, 'none', 0, 0.06, pal.ink, 3));
    paths.push(P(`M 48 ${byy + 8} L 44 ${byy + 13} L 48 ${byy + 18}`, pal.accent, 1.4, 0.7));
    paths.push(P(`M 54 ${byy + 8} L 58 ${byy + 13} L 54 ${byy + 18}`, pal.accent, 1.4, 0.7));
    for (let li = 1; li < 3; li++) {
      const lx = 62, ly = byy + 13 + li * 12;
      paths.push(P(`M ${lx} ${ly} L ${(lx + 60 + rand() * (bw * 0.5)).toFixed(1)} ${ly}`, li === 2 && rand() < 0.5 ? pal.ochre : pal.ink, 1.3, 0.45));
    }
  });
  return { paths, circles, rects };
}

function genCoreDrive(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const cx = W / 2 + (rand() - 0.5) * W * 0.1, cy = 120 + (rand() - 0.5) * 18;
  const scale = W > 400 ? 1.15 : 1;
  const radii = [30, 60, 92].map(r => r * scale * (0.85 + rand() * 0.3));
  radii.forEach(r => circles.push(C(cx, cy, r, pal.ink, 1 + rand() * 0.6, 0.3 + rand() * 0.25, 'none', rand() < 0.4 ? '3 7' : 'none')));
  circles.push(C(cx, cy, 5 + rand() * 3, 'none', 0, 0.85, pal.accent));
  const spokes = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < spokes; i++) {
    const a = rand() * 6.28, r = radii[Math.floor(rand() * 3)];
    paths.push(P(`M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`, pal.ink, 1, 0.3 + rand() * 0.2));
  }
  const nodes = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < nodes; i++) {
    const a = rand() * 6.28, r = radii[Math.floor(rand() * 3)];
    circles.push(C(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5 + rand() * 2, 'none', 0, 0.55 + rand() * 0.3, rand() < 0.4 ? pal.accent : pal.ink));
  }
  const a0 = rand() * 6.28, sweep = 0.7 + rand() * 1.1, r = radii[2];
  paths.push(P(`M ${(cx + Math.cos(a0) * r).toFixed(1)} ${(cy + Math.sin(a0) * r).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + Math.cos(a0 + sweep) * r).toFixed(1)} ${(cy + Math.sin(a0 + sweep) * r).toFixed(1)}`, pal.accent, 2.2, 0.75));
  return { paths, circles, rects };
}

function genPlan(rand, W, pal) {
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
    paths.push(P(`M ${mx.toFixed(1)} ${my - 6} L ${(mx + 6).toFixed(1)} ${my} L ${mx.toFixed(1)} ${my + 6} L ${(mx - 6).toFixed(1)} ${my} Z`, 'none', 0, 0.8, 'none', pal.ochre));
  }
  const tx = 60 + rand() * (W - 120);
  paths.push(P(`M ${tx.toFixed(1)} 20 L ${tx.toFixed(1)} 222`, pal.ochre, 1.4, 0.55, '5 4'));
  return { paths, circles, rects };
}

function genDecision(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const LX = [40, W * 0.4, W * 0.68, W - 28];
  const nodes = [[{ y: 120 + (rand() - 0.5) * 30 }]];
  for (let lvl = 1; lvl < 4; lvl++) {
    const n = Math.pow(2, lvl), arr = [];
    for (let i = 0; i < n; i++) arr.push({ y: 30 + ((i + 0.5) * 180) / n + (rand() - 0.5) * 14 });
    nodes.push(arr);
  }
  const chosenLeaf = Math.floor(rand() * 8);
  const chosen = [0, chosenLeaf >> 2, chosenLeaf >> 1, chosenLeaf];
  for (let lvl = 0; lvl < 3; lvl++) {
    nodes[lvl].forEach((nd, i) => {
      [0, 1].forEach(b => {
        const child = nodes[lvl + 1][i * 2 + b];
        const onPath = chosen[lvl] === i && chosen[lvl + 1] === i * 2 + b;
        const mx = (LX[lvl] + LX[lvl + 1]) / 2;
        paths.push(P(`M ${LX[lvl].toFixed(1)} ${nd.y.toFixed(1)} C ${mx.toFixed(1)} ${nd.y.toFixed(1)}, ${mx.toFixed(1)} ${child.y.toFixed(1)}, ${LX[lvl + 1].toFixed(1)} ${child.y.toFixed(1)}`, onPath ? pal.accent : pal.ink, onPath ? 2 : 1.1, onPath ? 0.8 : 0.28, onPath ? 'none' : (rand() < 0.35 ? '3 5' : 'none')));
      });
    });
  }
  for (let lvl = 0; lvl < 4; lvl++) {
    nodes[lvl].forEach((nd, i) => {
      const onPath = chosen[lvl] === i;
      circles.push(C(LX[lvl], nd.y, onPath ? 4.5 : 3, onPath ? 'none' : pal.ink, onPath ? 0 : 1.1, onPath ? 0.85 : 0.45, onPath ? pal.accent : pal.paper));
    });
  }
  return { paths, circles, rects };
}

function genBuild(rand, W, pal) {
  const paths = [], circles = [], rects = [];
  const w = 26, h = 13, d = 24, lift = 2 * h + d - 2;
  const cols = [0.24, 0.41, 0.59, 0.76].map(f => f * W + (rand() - 0.5) * 10);
  const baseY = 152;
  const cubes = [];
  cols.forEach(x => {
    const stack = Math.floor(rand() * 4);
    for (let lvl = 0; lvl < stack; lvl++) cubes.push({ x, y: baseY - lvl * lift });
  });
  if (cubes.length < 4) cubes.push({ x: cols[1], y: baseY }, { x: cols[2], y: baseY });
  const hi = Math.floor(rand() * cubes.length);
  cubes.forEach((c, i) => {
    const col = i === hi ? pal.accent : pal.ink;
    const top = `M ${c.x.toFixed(1)} ${c.y} L ${(c.x + w).toFixed(1)} ${c.y + h} L ${c.x.toFixed(1)} ${c.y + 2 * h} L ${(c.x - w).toFixed(1)} ${c.y + h} Z`;
    const left = `M ${(c.x - w).toFixed(1)} ${c.y + h} L ${c.x.toFixed(1)} ${c.y + 2 * h} L ${c.x.toFixed(1)} ${c.y + 2 * h + d} L ${(c.x - w).toFixed(1)} ${c.y + h + d} Z`;
    const right = `M ${(c.x + w).toFixed(1)} ${c.y + h} L ${c.x.toFixed(1)} ${c.y + 2 * h} L ${c.x.toFixed(1)} ${c.y + 2 * h + d} L ${(c.x + w).toFixed(1)} ${c.y + h + d} Z`;
    if (i === hi) paths.push(P(top, col, 1.2, 0.35, 'none', pal.accent)); else paths.push(P(top, col, 1.2, 0.65));
    paths.push(P(left, col, 1.2, 0.55));
    paths.push(P(right, col, 1.2, 0.14, 'none', col));
    paths.push(P(right, col, 1.2, 0.6));
  });
  let gd = `M 44 ${baseY + 2 * h + d + 8}`;
  for (let x = 74; x <= W - 36; x += 30) gd += ` L ${x} ${(baseY + 2 * h + d + 8 + (rand() - 0.5) * 3).toFixed(1)}`;
  paths.push(P(gd, pal.ink, 1.3, 0.35));
  for (let k = 0; k < 3; k++) circles.push(C(50 + rand() * (W - 100), 30 + rand() * 40, 1.8 + rand() * 1.5, 'none', 0, 0.5, pal.ochre));
  return { paths, circles, rects };
}

const TYPE_GEN = {
  Essay: genEssay,
  Blog: genBlog,
  'Core Drive': genCoreDrive,
  Plan: genPlan,
  Decision: genDecision,
  Build: genBuild,
};

/**
 * Build-time hero/thumbnail art for an article.
 * @param {'Essay'|'Blog'|'Core Drive'|'Plan'|'Decision'|'Build'} type
 * @param {string} slug - article slug; seed source, so identical slug always draws identical art
 * @param {number} width - 640 for wide hero (viewBox 640x240), 320 for thumbnail (viewBox 320x240)
 * @param {{ink:string, accent:string, ochre:string, paper:string}} palette
 * @returns {string} standalone SVG markup string
 */
export function renderHeroSVG(type, slug, width, palette) {
  const gen = TYPE_GEN[type];
  if (!gen) throw new Error(`Unknown hero art type "${type}". Expected one of ${Object.keys(TYPE_GEN).join(', ')}`);
  const rand = mulberry32(hashStr(type + '::' + slug));
  const art = gen(rand, width, palette);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 240" aria-hidden="true">`;
  (art.rects || []).forEach(r => { s += `<rect x="${r.x}" y="${r.y}" width="${r.wd}" height="${r.ht}" rx="${r.rx}" stroke="${r.stroke}" stroke-width="${r.w}" fill="${r.fill}" opacity="${r.o}"/>`; });
  (art.paths || []).forEach(p => { s += `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.w}" stroke-dasharray="${p.dash}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.o}"/>`; });
  (art.circles || []).forEach(c => { s += `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" stroke="${c.stroke}" stroke-width="${c.w}" stroke-dasharray="${c.dash}" fill="${c.fill}" opacity="${c.o}"/>`; });
  return s + '</svg>';
}

export const HERO_ART_PALETTES = {
  light: { ink: '#55493d', accent: '#783a44', ochre: '#9d884a', paper: '#f1ebdf' },
  dark: { ink: '#aaa298', accent: '#a4646d', ochre: '#d4b65c', paper: '#251f19' },
};
