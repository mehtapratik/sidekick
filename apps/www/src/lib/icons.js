// The design's icon set (Main.dc.html) as inner SVG markup for a 24×24,
// 1.6px-stroke icon. Shared by Icon.astro and the callout rehype plugin in
// astro.config.mjs.
export const ICONS = {
   search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
   contrast:
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
   sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
   moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
   monitor: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
   close: '<path d="M6 6l12 12M18 6L6 18"/>',
   "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
   "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
   "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
   "arrow-up-right": '<path d="M7 17L17 7M9 7h8v8"/>',
   "chevron-right": '<path d="M9 6l6 6-6 6"/>',
   rss: '<path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8"/><circle cx="6" cy="18" r="1.2" fill="currentColor"/>',
   copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V5.5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/>',
   check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
   list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
   play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
   // Callouts
   note: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
   info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
   question:
      '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.4M12 16.9v.1"/>',
   "see-also": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
   caution: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.4v.1"/>',
   warning:
      '<path d="M12 3l9 4.5v5c0 4.6-3.8 7.8-9 8.5-5.2-.7-9-3.9-9-8.5v-5z"/><path d="M12 8.5v4.5M12 15.9v.1"/>',
   danger: '<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
};

/** Standalone decorative SVG markup for `name`. */
export function iconSvg(name, size) {
   const dims = size ? ` width="${size}" height="${size}"` : "";
   return `<svg viewBox="0 0 24 24"${dims} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}
