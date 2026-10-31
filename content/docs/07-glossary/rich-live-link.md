---
publish: false
id: glossary.rich-live-link
created: 2026-10-25
updated: 2026-10-30
kind: glossary
version: 0.2.0
tags:
   - glossary
   - synergy
---

How a [[relationship|link]] appears where it is [[mention|mentioned]]: more than a hyperlink. A direct mention picks one of four display types: inline (`{title} ({type}) - [{status}]`), card, live preview of the whole target, and minimal (the label, or the target's title, with a dot when the target needs attention). The display type belongs to the mention, so a document can show several and the two ends of a link can show it differently. The component lives in Synergy, owns the frame and the states, and gets the content from the renderer the target's [[provider]] registered.
