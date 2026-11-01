---
publish: true
id: system-design.non-functional.monorepo.turborepo
title: Turborepo
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - monorepo
   - turborepo
   - pnpm
---

<div class=card>
	<header>Why pnpm isn’t enough? Doesn’t pnpm support workspaces, and by extension, wouldn’t it support task orchestration?</header>
	<section> 
pnpm supports task orchestration with the exception of two features supported by Turborepo: task parallelization is only supported partially in pnpm and caching is not supported at all. Therefore, if you can manage without speed and caching features, `pnpm` is a sufficient task runner.  In case of Sidekick, we expect the repo to grow over time. And as the repo grows, managing this manually may become fragile and slow.  So, we’re using Turborepo from day one to avoid this.</section>
</div>

## Decision History

- 2026-09-19 · accepted · Why Turborepo
