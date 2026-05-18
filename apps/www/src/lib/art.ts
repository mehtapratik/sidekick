/**
 * Inline SVG art helpers — geometric, abstract, deterministic.
 * Each function returns an SVG string sized to fill its container.
 *
 * The variants chosen are deterministic per slug so each post gets
 * a stable mark across renders.
 */

export type ArtKind = "hero" | "thumb" | "figure";

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const HERO_VARIANTS = ["concentric", "blueprint", "rays", "topo"] as const;
type HeroVariant = (typeof HERO_VARIANTS)[number];

export function heroSvg(seed: string): string {
  const variant = HERO_VARIANTS[djb2(seed) % HERO_VARIANTS.length];
  return renderHero(variant);
}

export function heroSvgVariant(variant: HeroVariant): string {
  return renderHero(variant);
}

function renderHero(variant: HeroVariant): string {
  if (variant === "blueprint") {
    return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <defs>
    <pattern id="g1" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.25"/>
    </pattern>
  </defs>
  <rect width="800" height="450" fill="url(#g1)"/>
  <g stroke="currentColor" fill="none" stroke-width="1.2">
    <rect x="120" y="120" width="240" height="210"/>
    <rect x="360" y="120" width="160" height="100"/>
    <rect x="360" y="220" width="160" height="110"/>
    <rect x="520" y="120" width="160" height="210"/>
  </g>
  <g stroke="currentColor" stroke-width="1" opacity="0.6">
    <line x1="120" y1="100" x2="680" y2="100"/>
    <line x1="100" y1="120" x2="100" y2="330"/>
  </g>
  <text x="120" y="92" font-family="ui-monospace, monospace" font-size="10" fill="currentColor" opacity="0.65" letter-spacing="2">560 UNITS</text>
  <text x="86" y="335" font-family="ui-monospace, monospace" font-size="10" fill="currentColor" opacity="0.65" letter-spacing="2" transform="rotate(-90 86 335)">210 UNITS</text>
</svg>`;
  }
  if (variant === "rays") {
    return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <g stroke="currentColor" stroke-width="1" opacity="0.55">
    ${Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI;
      const x = 400 + Math.cos(a) * 320;
      const y = 225 + Math.sin(a) * 220;
      return `<line x1="400" y1="225" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join("")}
  </g>
  <circle cx="400" cy="225" r="4" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="1" fill="none" opacity="0.85">
    <circle cx="400" cy="225" r="60"/>
    <circle cx="400" cy="225" r="120"/>
  </g>
  <text x="40" y="60" font-family="ui-monospace, monospace" font-size="11" fill="currentColor" opacity="0.5" letter-spacing="2">FIG · DISPERSION</text>
</svg>`;
  }
  if (variant === "topo") {
    return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <g stroke="currentColor" fill="none" stroke-width="0.9" opacity="0.7">
    ${Array.from({ length: 8 }, (_, i) => {
      const r = 60 + i * 30;
      return `<ellipse cx="420" cy="240" rx="${r}" ry="${r * 0.62}"/>`;
    }).join("")}
  </g>
  <g stroke="currentColor" stroke-width="1" opacity="0.6">
    <line x1="40" y1="60" x2="200" y2="60"/>
    <line x1="40" y1="80" x2="170" y2="80"/>
  </g>
  <text x="40" y="50" font-family="ui-monospace, monospace" font-size="10" fill="currentColor" opacity="0.6" letter-spacing="2">TOPO · SEED</text>
</svg>`;
  }
  // concentric (default)
  return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <g stroke="currentColor" stroke-width="1" fill="none" opacity="0.85">
    <circle cx="540" cy="225" r="160"/>
    <circle cx="540" cy="225" r="120"/>
    <circle cx="540" cy="225" r="80"/>
    <circle cx="540" cy="225" r="40"/>
  </g>
  <g stroke="currentColor" stroke-width="1" opacity="0.55">
    <line x1="40" y1="225" x2="320" y2="225"/>
    <line x1="40" y1="200" x2="200" y2="200"/>
    <line x1="40" y1="250" x2="180" y2="250"/>
    <line x1="40" y1="175" x2="140" y2="175"/>
    <line x1="40" y1="275" x2="160" y2="275"/>
  </g>
  <circle cx="540" cy="225" r="3" fill="currentColor"/>
  <text x="40" y="60" font-family="ui-monospace, monospace" font-size="11" fill="currentColor" opacity="0.5" letter-spacing="2">FIG · CONVERGENCE</text>
</svg>`;
}

const THUMB_VARIANTS = ["a", "b", "c", "d", "e", "f"] as const;
type ThumbVariant = (typeof THUMB_VARIANTS)[number];

export function thumbSvg(seed: string): string {
  const variant = THUMB_VARIANTS[djb2(seed) % THUMB_VARIANTS.length];
  return renderThumb(variant);
}

function renderThumb(variant: ThumbVariant): string {
  const variants: Record<ThumbVariant, string> = {
    a: `<g stroke="currentColor" fill="none" stroke-width="1.2"><circle cx="120" cy="90" r="50"/><circle cx="80" cy="90" r="50"/></g>`,
    b: `<g stroke="currentColor" fill="none" stroke-width="1.2"><path d="M30 150 L100 30 L170 150 Z"/><path d="M55 110 L145 110"/></g>`,
    c: `<g stroke="currentColor" stroke-width="1"><line x1="30" y1="40" x2="170" y2="40"/><line x1="30" y1="70" x2="140" y2="70"/><line x1="30" y1="100" x2="160" y2="100"/><line x1="30" y1="130" x2="110" y2="130"/></g><g stroke="currentColor" fill="none" stroke-width="1.2"><rect x="125" y="115" width="35" height="35"/></g>`,
    d: `<g stroke="currentColor" fill="none" stroke-width="1.2"><path d="M30 150 Q60 30 100 90 T170 30"/></g><circle cx="30" cy="150" r="3" fill="currentColor"/><circle cx="170" cy="30" r="3" fill="currentColor"/>`,
    e: `<g stroke="currentColor" fill="none" stroke-width="1.2"><rect x="35" y="35" width="50" height="50"/><rect x="95" y="35" width="50" height="50"/><rect x="35" y="95" width="50" height="50"/><rect x="95" y="95" width="50" height="50" fill="currentColor" opacity="0.15"/></g>`,
    f: `<g stroke="currentColor" fill="none" stroke-width="1"><circle cx="100" cy="90" r="60"/><line x1="100" y1="30" x2="100" y2="150"/><line x1="40" y1="90" x2="160" y2="90"/><line x1="60" y1="50" x2="140" y2="130"/><line x1="60" y1="130" x2="140" y2="50"/></g>`,
  };
  return `
<svg viewBox="0 0 200 180" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="200" height="180" fill="var(--bg-sunk)"/>
  ${variants[variant]}
</svg>`;
}

export function figureSvg(kind: "flow" | "stack" | "default" = "default"): string {
  if (kind === "flow") {
    return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="currentColor"/></marker>
  </defs>
  <g stroke="currentColor" fill="none" stroke-width="1.2" font-family="ui-monospace,monospace" font-size="11">
    <rect x="60" y="180" width="140" height="90"/>
    <text x="130" y="230" text-anchor="middle" fill="currentColor">CAPTURE</text>
    <rect x="330" y="180" width="140" height="90"/>
    <text x="400" y="230" text-anchor="middle" fill="currentColor">PROCESS</text>
    <rect x="600" y="180" width="140" height="90"/>
    <text x="670" y="230" text-anchor="middle" fill="currentColor">PUBLISH</text>
    <path d="M200 225 L330 225 M460 225 L600 225" marker-end="url(#arr)"/>
    <circle cx="130" cy="80" r="22"/>
    <circle cx="400" cy="80" r="22"/>
    <circle cx="670" cy="80" r="22"/>
    <path d="M130 102 L130 180 M400 102 L400 180 M670 102 L670 180" stroke-dasharray="3 4"/>
  </g>
</svg>`;
  }
  if (kind === "stack") {
    return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <g stroke="currentColor" fill="none" stroke-width="1.2">
    <rect x="200" y="80" width="400" height="60"/>
    <rect x="200" y="150" width="400" height="60"/>
    <rect x="200" y="220" width="400" height="60"/>
    <rect x="200" y="290" width="400" height="60"/>
  </g>
  <g font-family="ui-monospace,monospace" font-size="11" fill="currentColor">
    <text x="220" y="115">PRESENTATION ~ astro + css</text>
    <text x="220" y="185">CONTENT ~ markdown + frontmatter</text>
    <text x="220" y="255">ROUTING ~ collections + slugs</text>
    <text x="220" y="325">BUILD ~ static pre-render</text>
  </g>
  <g stroke="currentColor" opacity="0.4" stroke-width="0.8">
    <line x1="160" y1="80" x2="160" y2="350"/>
    <line x1="640" y1="80" x2="640" y2="350"/>
    <line x1="160" y1="110" x2="148" y2="110"/>
    <line x1="160" y1="180" x2="148" y2="180"/>
    <line x1="160" y1="250" x2="148" y2="250"/>
    <line x1="160" y1="320" x2="148" y2="320"/>
  </g>
</svg>`;
  }
  return `
<svg viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="800" height="450" fill="var(--bg-sunk)"/>
  <g stroke="currentColor" fill="none" stroke-width="1"><circle cx="400" cy="225" r="180"/><circle cx="400" cy="225" r="120"/><circle cx="400" cy="225" r="60"/></g>
</svg>`;
}
