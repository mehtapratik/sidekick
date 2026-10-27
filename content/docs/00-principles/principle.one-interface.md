---
id: principle.one-interface
title: One Interface
created: 2026-10-27
kind: guidance
version: 1.0.0
tags:
   - principle
   - api
   - cli
publish: true
---

A bot calls Sidekick's API at three in the morning. It has no other way in. It gets what the documentation promises, or it fails. If Sidekick's own app uses a different path, nobody inside notices the failure.

So every capability gets one interface. The web app, the CLI, scheduled jobs, agents and third parties all use it the same way. Sidekick never keeps a private path for itself beside a public one it doesn't use.

If that interface is too slow, too awkward or missing a field for the web app, it is the same for everyone else. Fix it there. Don't build a shortcut around it.

This rule stops at maintenance. Migrations and break-glass scripts in `packages/ops` do things no consumer may do. They aren't a second way into a capability, and each one retires once a real endpoint replaces it.

Taste your own cooking before you serve it.
