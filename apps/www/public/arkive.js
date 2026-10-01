// Arkive — progressive enhancement. The site works fully without this file:
//   - the Index opens and closes with the native Popover API (no JS),
//   - previous/next are plain links in as-of order,
//   - tag links go to pre-rendered /tags/<tag>/ pages.
// This script adds, on top:
//   1. search and tag filtering inside the Index,
//   2. a filter that persists for the browser session (sessionStorage),
//   3. previous/next rewritten to follow the filter,
//   4. "Index (filtered)" on the button while a filter is on,
//   5. the By folder tree following the filter (hidden folders, counts, auto-open),
//   6. remembering the chosen view (By date / By folder) for the session,
//   7. copy buttons on code blocks.
// Load it with <script type="module" src="/arkive.js"></script>.

const KEY = "arkive:filter";
const VIEW_KEY = "arkive:view";
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const empty = () => ({ q: "", tag: "" });
const load = () => {
   try { return { ...empty(), ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; }
   catch { return empty(); }
};
const save = (f) => {
   try {
      if (f.q.trim() || f.tag) sessionStorage.setItem(KEY, JSON.stringify(f));
      else sessionStorage.removeItem(KEY);
   } catch { /* private mode: filter lasts for this page only */ }
};

let filter = load();
const index = $("#index");
const rows = $$("#index .entries tbody tr");            // server-rendered, newest first
const total = rows.length;
const plural = (n) => (n === 1 ? "1 entry" : `${n} entries`);
const rowByUrl = new Map(rows.map((tr) => [tr.dataset.url, tr]));
const leaves = $$("#index .tree li[data-url]");
const folders = $$("#index .tree li.folder");
for (const li of folders) {                              // remember the server-rendered open state
   const d = $(":scope > details", li);
   if (d) d.dataset.defaultOpen = String(d.open);
}
let lastSignature = null;

function isOn(f) { return Boolean(f.q.trim() || f.tag); }

function describe(f) {
   const parts = [];
   if (f.tag) parts.push(`tag “${f.tag}”`);
   if (f.q.trim()) parts.push(`“${f.q.trim()}”`);
   return parts.join(" and ");
}

function matches(tr, f) {
   if (f.tag && !tr.dataset.tags.split(" ").includes(f.tag)) return false;
   const q = f.q.trim().toLowerCase();
   return !q || tr.dataset.search.includes(q);
}

function renderPagerSlot(slot, row, noneText) {
   slot.replaceChildren();
   if (row) {
      const a = document.createElement("a");
      a.href = row.dataset.url;
      a.rel = slot.dataset.slot;                       // "prev" | "next"
      a.textContent = row.dataset.title;
      slot.append(a);
   } else {
      const s = document.createElement("span");
      s.className = "muted";
      s.textContent = noneText;
      slot.append(s);
   }
}

function apply() {
   const f = filter;
   const on = isOn(f);
   const text = describe(f);

   // 1. Index rows and count
   let n = 0;
   for (const tr of rows) {
      const ok = matches(tr, f);
      tr.hidden = !ok;
      if (ok) n++;
   }
   const count = $("[data-count]");
   if (count) count.textContent = on ? `${plural(n)} of ${total} match ${text}.` : `${plural(total)}.`;

   // 1b. By folder tree: leaves, then folders (counts, visibility, open state)
   for (const li of leaves) {
      const tr = rowByUrl.get(li.dataset.url);
      li.hidden = !(tr && matches(tr, f));
   }
   const signature = JSON.stringify(f);
   const filterChanged = signature !== lastSignature;
   lastSignature = signature;
   for (const li of folders) {
      const c = li.querySelectorAll("li[data-url]:not([hidden])").length;
      li.hidden = c === 0;
      const out = $("[data-folder-count]", li);
      if (out) out.textContent = on ? `${c} of ${li.dataset.total}` : li.dataset.total;
      const d = $(":scope > details", li);
      if (d && filterChanged) d.open = on ? c > 0 : d.dataset.defaultOpen === "true";
   }
   const none = $("[data-none]");
   if (none) none.hidden = n > 0;
   const table = $("#index .entries");
   if (table) table.hidden = n === 0;

   // 2. Search box, active tag line, tag cloud
   const input = $("#index-search");
   if (input && input.value !== f.q) input.value = f.q;
   const active = $("[data-active-tag]");
   if (active) {
      active.hidden = !f.tag;
      const b = $("b", active);
      if (b) b.textContent = f.tag;
   }
   for (const a of $$(".cloud a[data-tag]")) {
      if (a.dataset.tag === f.tag) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
   }

   // 3. Index button label
   for (const btn of $$("[data-index-button]")) {
      btn.textContent = on ? "Index (filtered)" : "Index";
      btn.setAttribute("aria-label", on ? `Index, filtered by ${text}, ${plural(n)}` : "Index of all entries");
   }

   // 4. Previous / next follow the filter
   const current = document.body.dataset.entry;           // e.g. "/writings/model-heuristics/"
   const at = rows.findIndex((tr) => tr.dataset.url === current);
   if (at >= 0) {
      const ok = (tr) => matches(tr, f);
      const older = rows.slice(at + 1).find(ok) || null;
      const newer = rows.slice(0, at).reverse().find(ok) || null;
      const prevSlot = $('[data-slot="prev"]');
      const nextSlot = $('[data-slot="next"]');
      if (prevSlot) renderPagerSlot(prevSlot, older, "None. This is the earliest entry.");
      if (nextSlot) renderPagerSlot(nextSlot, newer, "None. This is the latest entry.");
   }
   const scope = $("[data-scope]");
   if (scope) scope.textContent = on
      ? `Previous and next follow your filter (${text}, ${plural(n)}).`
      : `Previous and next follow all ${plural(total)}, by as-of date.`;
   for (const b of $$("[data-clear]")) b.hidden = !on;
}

function set(next) {
   filter = { ...filter, ...next };
   save(filter);
   apply();
}

// --- wire up ----------------------------------------------------------------
const form = $("#index form[role=search]");
if (form) {
   form.hidden = false;                                    // search needs JS, so it ships hidden
   form.addEventListener("submit", (e) => e.preventDefault());
   $("#index-search")?.addEventListener("input", (e) => set({ q: e.target.value }));
}

document.addEventListener("click", (e) => {
   if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

   const tagLink = e.target.closest("a[data-tag]");
   if (tagLink && index) {
      e.preventDefault();
      const t = tagLink.dataset.tag;
      const fromIndex = Boolean(tagLink.closest("#index"));
      // In the Index a tag narrows the current search; from an article it starts a fresh filter.
      set(fromIndex ? { tag: filter.tag === t ? "" : t } : { tag: t, q: "" });
      if (!index.matches(":popover-open")) index.showPopover();
      return;
   }
   if (e.target.closest("[data-remove-tag]")) { e.preventDefault(); set({ tag: "" }); return; }
   if (e.target.closest("[data-clear]")) { e.preventDefault(); set(empty()); return; }
   if (e.target.closest("a.wordmark")) { save(empty()); return; }     // home = newest entry, filter reset

   const copy = e.target.closest("button[data-copy]");
   if (copy) {
      const pre = copy.closest("figure")?.querySelector("pre");
      if (!pre || !navigator.clipboard) return;
      navigator.clipboard.writeText(pre.innerText).then(() => {
         copy.textContent = "Copied";
         setTimeout(() => { copy.textContent = "Copy"; }, 1600);
      });
   }
});

for (const b of $$("button[data-copy]")) b.hidden = !navigator.clipboard;

// View switch: CSS does the switching; the script only remembers the choice for the session.
try {
   const v = sessionStorage.getItem(VIEW_KEY);
   const radio = v && $(`#index input[name="index-view"][value="${v}"]`);
   if (radio) radio.checked = true;
} catch { /* ignore */ }
for (const r of $$('#index input[name="index-view"]')) {
   r.addEventListener("change", () => { try { sessionStorage.setItem(VIEW_KEY, r.value); } catch { /* ignore */ } });
}

apply();
