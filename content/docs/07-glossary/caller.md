---
publish: false
id: glossary.caller
title: Caller
created: 2026-11-24
updated: 2026-11-24
kind: glossary
version: 0.1.0
tags:
   - glossary
   - security
---

How a request proved who it is: a signed-in `session` or an `api_key`. `withApiGuard` resolves it into an `ApiCaller`, which names the [[user]] the request works for; Synergy's `identifyActor` turns the caller into the [[actor]] it records.

Work that runs inside the system, such as a scheduled job, has an actor but no caller (Pratik, 2026-11-24, Synergy lesson 5).
