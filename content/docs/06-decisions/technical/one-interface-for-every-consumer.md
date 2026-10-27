---
publish: true
id: decision.technical.one-interface-for-every-consumer
created: 2026-10-27
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - api
   - cli
status: accepted
applies_to:
   - "[[03-system-design/non-functional/api/public-api-only]]"
   - "[[principle.one-interface]]"
   - "[[03-system-design/non-functional/nextjs/server-actions]]"
---

## What

Every capability has one interface. Sidekick's own clients use it exactly the way bots, jobs, agents and third parties do. No internal path sits beside a public one: no server actions, no pages that read the database directly, no private routes that copy a public endpoint.

## Why

- Bots and agents can't tell you a screen is confusing. They fail quietly against a contract nobody inside tested.
- Two paths to one capability drift apart, and the one Sidekick doesn't use is the one that breaks.
- An API its own maker uses every day is one others can trust.

## Consequences

- When the interface doesn't serve Sidekick's own UI well, change the interface. Don't route around it.
- `packages/ops` is outside this rule. It holds privileged maintenance, not a second way into a capability, and each script names the endpoint that will retire it.
