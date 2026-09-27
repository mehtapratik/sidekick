---
title: Profile creation Postgres trigger
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - security
  - postgresql
  - api
  - authentication
appliesTo: []
isSection: false
docId: system-design.non-functional.security.profile-creation-postgress-trigger
sourcePath: >-
  sources/docs/03-system-design/non-functional/security/profile-creation-postgres-trigger.md
wordCount: 98
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

[[user-profile-creation-by-db-trigger|Why?]]

\> User profiles are created via a Postgres trigger on `auth.users`, not via an API route. This ensures reliability across auth providers and prevents race conditions, as profile creation becomes part of the same database transaction.

\> Prefix tables with `public.` while referencing them in triggers and functions. They execute in the schema context of the table that fired the trigger. Since this trigger is on `auth.users`, writing `INSERT INTO profiles` inside the trigger function would look for `auth.profiles`, which does not exist. The table must be referenced as `public.profiles` (fully qualified) or the insert will fail.
