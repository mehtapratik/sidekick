---
publish: true
id: decision.technical.why-turborepo
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - turborepo
   - pnpm
status: accepted
---

<div class=card>
	<header>Why pnpm isn’t enough? Doesn’t pnpm support workspaces, and by extension, wouldn’t it support task orchestration?</header>
	<section> 
pnpm supports task orchestration with the exception of two features supported by Turborepo: task parallelization is only supported partially in pnpm and caching is not supported at all. Therefore, if you can manage without speed and caching features, `pnpm` is a sufficient task runner.  In case of Sidekick, we expect the repo to grow over time. And as the repo grows, managing this manually may become fragile and slow.  So, we’re using Turborepo from day one to avoid this.</section>
</div>
