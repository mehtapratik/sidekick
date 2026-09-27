---
title: Authentication
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - security
  - taxila
  - api
  - authentication
  - pwa
  - mobile
  - cli
appliesTo: []
isSection: false
docId: system-design.non-functional.security.authentication
sourcePath: sources/docs/03-system-design/non-functional/security/authentication.md
wordCount: 85
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Web app, PWA, and iOS will use cookie-based session for authentication.
- CLI, agents and API access will use bearer keys.
- API keys will support SHA-256 hashing, scopes, expiry, revocation, last-used tracking.
- Example of API scopes
   - `notes:read`
   - `notes:write`,
   - `taxila:read`
- API Keys Table Definition

```tsx
export const apiKeys = pgTable("api_keys", {
   id: uuid("id").primaryKey(),
   userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, {
         onDelete: "cascade",
      }),
   keyHash: text("key_hash").notNull(),
   label: text("label"),
   scopes: text("scopes")
      .array()
      .default(sql`'{}'`),
   expiresAt: timestamp("expires_at"),
   revokedAt: timestamp("revoked_at"),
   lastUsedAt: timestamp("last_used_at"),
});
```
