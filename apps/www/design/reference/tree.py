"""Folder tree for the Index: built at 'build time' from entry paths."""
SECTION = [("writings", "Writings"), ("docs/prd", "Product requirements"), ("docs/system-design", "System design"),
           ("docs/plans", "Plans"), ("docs/builds", "Builds"), ("docs/decisions", "Decisions"),
           ("docs/glossary", "Glossary"), ("docs/harness", "AI coding harness")]
WORDS = {"ai": "AI", "api": "API", "cli": "CLI", "pwa": "PWA", "rag": "RAG", "css": "CSS", "ux": "UX",
         "nextjs": "Next.js", "typescript": "TypeScript", "eslint": "ESLint", "and": "and", "auth": "auth"}

OVERRIDE = {"non-functional": "Non-functional"}

def human(slug):
    if slug in OVERRIDE:
        return OVERRIDE[slug]
    if slug.startswith("phase-"):
        parts = slug.split("-")
        return "Phase " + parts[1] + ": " + human("-".join(parts[2:])) if len(parts) > 2 else "Phase " + parts[1]
    ws = [WORDS.get(w, w) for w in slug.split("-")]
    if ws and ws[0] == ws[0].lower():
        ws[0] = ws[0][:1].upper() + ws[0][1:]
    return " ".join(ws)

def build(data):
    """Returns a list of top-level nodes. Node: {'type':'folder','path','label','children'} | {'type':'entry','id'}"""
    order = {d["id"]: i for i, d in enumerate(data)}          # data is newest-first already
    folders = {}
    def folder(path, label=None):
        if path not in folders:
            folders[path] = {"type": "folder", "path": path, "label": label or human(path.rsplit("/", 1)[-1]), "children": [], "entries": []}
        return folders[path]
    roots = [folder(p, l) for p, l in SECTION]
    ids = {d["id"] for d in data}
    for d in data:
        i = d["id"]
        top = next(p for p, _ in SECTION if i == p or i.startswith(p + "/"))
        rest = i[len(top) + 1:].split("/")
        # an entry whose path is also a folder lives inside that folder, first
        own_folder = any(j.startswith(i + "/") for j in ids)
        parts = rest if own_folder else rest[:-1]
        cur = folders[top]
        path = top
        for seg in parts:
            path = path + "/" + seg
            f = folder(path)
            if f not in cur["children"]:
                cur["children"].append(f)
            cur = f
        cur["entries"].append({"type": "entry", "id": i, "own": own_folder})
    def finish(f):
        for c in f["children"]:
            finish(c)
        f["children"].sort(key=lambda c: c["label"].lower())
        f["entries"].sort(key=lambda e: (not e["own"], order[e["id"]]))
        # hoist single-entry subfolders into this folder
        keep = []
        for c in f["children"]:
            if not c["children"] and len(c["entries"]) == 1:
                f["entries"].append(c["entries"][0])
            else:
                keep.append(c)
        f["children"] = keep
        f["entries"].sort(key=lambda e: (not e["own"], order[e["id"]]))
        # compact a folder whose only content is one subfolder: "Decisions / Technical"
        while not f["entries"] and len(f["children"]) == 1:
            only = f["children"][0]
            f["label"] = f["label"] + " / " + only["label"]
            f["path"] = only["path"]
            f["children"], f["entries"] = only["children"], only["entries"]
    for r in roots:
        finish(r)
    return [r for r in roots if r["children"] or r["entries"]]

def walk(nodes, depth=0):
    for n in nodes:
        yield n, depth
        if n["type"] == "folder":
            yield from walk(n["children"] + n["entries"], depth + 1)
