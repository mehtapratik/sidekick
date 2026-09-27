// Single-key shortcuts (1/2/3, ←/→, /, ?) share one on/off switch so a
// reader can turn them all off — WCAG 2.1.4 requires that for character-key
// shortcuts. Stored as localStorage["arkive-shortcuts"] = "off"; absent = on.
const KEY = "arkive-shortcuts";

export function shortcutsEnabled(): boolean {
   try {
      return localStorage.getItem(KEY) !== "off";
   } catch {
      return true;
   }
}

export function setShortcutsEnabled(on: boolean) {
   try {
      if (on) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "off");
   } catch {}
}

/** True when a key press belongs to the page, not to a shortcut. */
export function isEditing(e: KeyboardEvent): boolean {
   if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return true;
   const t = e.target as HTMLElement | null;
   return !!t?.closest?.("input, textarea, select, [contenteditable]");
}
