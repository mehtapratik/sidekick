---
title: May become part of Taxila
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - core-drive
  - taxila
appliesTo: []
isSection: false
docId: system-design.functional-design.core-drive.may-become-part-of-taxila
sourcePath: >-
  sources/docs/03-system-design/functional-design/01-core-drive/02-may-become-part-of-taxila.md
wordCount: 212
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

In a certain manner, Core Drive is nothing but a bunch of entries about user’s identity, personality, preferences, constraints, principles, working style, mental modal etc. Taxila, on the other hand, is defined as a knowledge management module of Sidekick. However, the line between Taxila and Core Drive may blur when you think of one’s journey as they learn from life and other people’s experiences. If this is a learning, it should be part of Taxila. But, if you say this experience/learning changed you as a person and redefined your values, it should be part of Core Drive.

For now, Core Drive is kept as a separate module because (a) its retrieval semantics differ, (b) its [[core-drive-vs-taxila|writing patterns differs]], and (c) the user should see their Core Drive as separate entity. If this means, certain learning may have redundancies between Core Drive and Taxila, so be it. And if I change my mind later, folding Core Drive into Taxila should be a cheap migration effort. Doing it the other way around would be hard.

Things are still settling. Vision of what Taxila and Core Drive will end up being is still not clear. Once the dust settle and when I have more clear picture, I will be able to make more definitive decision.
