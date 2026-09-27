---
title: Profile trigger and referential integrity
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - phase-2
  - database
  - authentication
  - integrity
  - severity-high
appliesTo: []
isSection: false
docId: opportunity.profile-trigger-and-referential-integrity
sourcePath: >-
  sources/docs/03-system-design/opportunities/profile-trigger-and-referential-integrity.md
wordCount: 55
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

The auth-user profile trigger is manual database state, and `profiles.id` lacks a foreign key to `auth.users(id)`.

**Risk**

Fresh environments can miss profile creation and deleted users can leave orphaned rows.

**Recommended fix**

Version `CREATE OR REPLACE FUNCTION` and the auth trigger in a migration. Add the foreign key with explicit `ON DELETE CASCADE` semantics.
