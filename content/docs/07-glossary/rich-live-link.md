---
publish: false
id: glossary.rich-live-link
created: 2026-10-25
kind: glossary
version: 0.1.0
tags:
   - glossary
   - synergy
---

How a relationship appears inside a document: more than a hyperlink. It comes in four display types: inline (`{type} - {title} [{status}]`), card, live preview of the whole target, and minimal (only the author's label, with a dot when the target needs attention). The author picks the type where the link is placed, so one document can show several. The component owns the frame and the states; the package that owns the target supplies the content through a registered renderer, so targets outside Sidekick can render too.
