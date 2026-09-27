---
title: Phase 11 dogfooding friends family access optional
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: draft
version: 1.0.0
tags:
  - plan
  - living-plan
  - phase-11
appliesTo: []
isSection: false
docId: plan.phase-11-dogfooding-friends-family-access-optional
sourcePath: sources/docs/04-plans/phase-11-dogfooding-friends-family-access-optional.md
wordCount: 204
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

> **Milestone:** You can invite others to use the app. They have their own isolated data. You have a basic way to manage who has access.
> **Learning payoff:** Multi-user ops, invite flows, feature management for different users.

| #    | Task                                                                                     | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| 11.1 | Build an invite flow — generate invite link that pre-approves sign-up                    | 🔴         | 🔐 🧩    |
| 11.2 | Build a simple admin page (your user only) to list users and manage feature entitlements | 🟡         | 🎨 🔐    |
| 11.3 | Add `isAdmin` flag to `profiles` table; gate admin pages behind it                       | 🟡         | 🔐       |
| 11.4 | Enable specific features for invited users from the admin panel                          | 🟡         |          |
| 11.5 | Test full sign-up and feature access flow from a fresh incognito session                 | 🟢         |          |
| 11.6 | Collect feedback from dogfood users; create a prioritized bug list                       | 🟢         |          |

**Phase 11 Exit Criteria:** You can invite someone, they can sign up, they have access only to the features you enabled for them, and their data is fully isolated from yours.

---
