---
title: Global tags and metadata
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - global-tagging-and-llinking
  - taxila
  - zinsser
  - alter-ego
  - war-room
  - factory
  - core-drive
appliesTo: []
isSection: false
docId: >-
  system-design.functional-design.global-tagging-and-llinking.global-tags-and-metadata
sourcePath: >-
  sources/docs/03-system-design/functional-design/02-global-tagging-and-linking/00-global-tags-and-metadata.md
wordCount: 109
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

New possibilities emerge when two or more features combine. Their combined value exceeds than mere sum of their individual values, which is to say:

$$
Sidekick \neq Core Drive + Taxila + Zinsser + War Room + Factory + Alter Ego
$$

To take full advantage of these synergies, Sidekick will not only store feature specific data in its own data tables, it will also have a relationship linking and metadata enrichment service available to all features. This way, an article written by Zinsser can link to a project being tracked in Factory, or War Room can link to available knowledgebase to provide evidence for the strategy being prepared.
