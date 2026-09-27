---
title: Why Turborepo
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - turborepo
  - pnpm
appliesTo: []
isSection: false
docId: decision.technical.why-turborepo
sourcePath: sources/docs/06-decisions/technical/why-turborepo.md
wordCount: 95
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

<div class=card>
	<header>Why pnpm isn’t enough? Doesn’t pnpm support workspaces, and by extension, wouldn’t it support task orchestration?</header>
	<section> 
pnpm supports task orchestration with the exception of two features supported by Turborepo: task parallelization is only supported partially in pnpm and caching is not supported at all. Therefore, if you can manage without speed and caching features, `pnpm` is a sufficient task runner.  In case of Sidekick, we expect the repo to grow over time. And as the repo grows, managing this manually may become fragile and slow.  So, we’re using Turborepo from day one to avoid this.</section>
</div>
