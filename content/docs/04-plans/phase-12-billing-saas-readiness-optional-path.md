---
id: plan.phase-12-billing-saas-readiness-optional-path
created: 2026-09-19
kind: plan
version: 1.0.0
status: deferred
tags:
   - plan
   - living-plan
   - phase-12
   - api
   - offline
---

> [!note]
> Per the PRD, Sidekick's motivation is "purely personal and utilitarian" — monetization is not a product goal. This phase exists because of the "built for one, designed for many" principle (architecture §2.4): the entitlement plumbing stays product-ready, but this phase runs only if Sidekick pursues the product path.

> **Milestone:** The app can charge for access. Feature entitlement is tied to subscription tier. The foundation for a real business offering.
> **Learning payoff:** Stripe integration, webhook handling, subscription state management, SaaS architecture patterns.

| #    | Task                                                                                                    | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 12.1 | Create Stripe account; configure products and price tiers                                               | 🟢         | 💳       |
| 12.2 | Add `subscriptions` table — `userId`, `stripeCustomerId`, `stripePriceId`, `status`, `currentPeriodEnd` | 🟡         | 🗄️ 💳    |
| 12.3 | Implement Stripe checkout session creation in `POST /api/billing/checkout`                              | 🟡         | 💳 🧩    |
| 12.4 | Implement Stripe webhook handler — sync subscription state into `subscriptions` table                   | 🔴         | 💳 🔐    |
| 12.5 | Update `getEnabledFeatures()` to resolve features from subscription tier as well as manual entitlements | 🔴         | 💳 🗄️    |
| 12.6 | Build billing settings page — current plan, upgrade CTA, portal link                                    | 🟡         | 🎨 💳    |
| 12.7 | Implement Stripe customer portal redirect for managing subscriptions                                    | 🟡         | 💳       |
| 12.8 | Add a landing page or marketing page explaining features per tier                                       | 🟢         | 🎨       |
| 12.9 | End-to-end test: sign up → subscribe → gain feature access → cancel → lose access                       | 🟡         |          |

**Phase 12 Exit Criteria:** A new user who subscribes to a paid plan automatically gains access to paid features. A cancelled user loses access at period end.

---
