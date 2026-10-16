---
publish: true
id: system-design.non-functional.security.with-api-guard
created: 2026-09-19
updated: 2026-10-16
kind: spec
version: 1.0.2
tags:
   - system-design
   - security
   - api-guard
   - rls
   - api
   - authentication
   - typescript
---

1. Centralizes common security concerns at public API layer so these checks aren’t scattered across multiple clients.
2. Funnels request through auth, feature entitlement checks, API scope validations, and RLS context setup before handing over request to handler.

**Implementation may look something like this:**

```javascript
export function withApiGuard(handler, opts = {}) {
   return async (req) => {
      const auth = await resolveApiCaller(req);

      if (!auth?.userId) {
         return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (opts.feature) {
         const features = await getEnabledFeatures(auth.userId);
         if (!features.some((f) => f.slug === opts.feature)) {
            return Response.json(
               { error: "Feature disabled" },
               { status: 403 },
            );
         }
      }

      return withRLS(auth.userId, async (tx) => {
         if (opts.requireScope && auth.isApiKey) {
            if (!auth.scopes?.includes(opts.requireScope)) {
               return Response.json({ error: "Forbidden" }, { status: 403 });
            }
         }

         return handler({
            tx,
            userId: auth.userId,
            req,
         });
      });
   };
}
```

**Public API handlers must be protected by this wrapper.** Enforced in two layers, both in CI: the `sidekick/require-api-guard` ESLint rule on every `app/**/route.*` file in every app, and `apps/web/scripts/verify-endpoints.mjs`, which reads Next.js's build manifests and fails the build if anything is served that is not a lint-checked route handler (Server Actions, Pages Router entries, code-generated metadata routes).

```typescript
const handler = async ({ tx }) => {
   const rows = await tx.select().from(notes);

   return Response.json({ data: rows });
};

const options = {
   feature: "notes",
   requireScope: "notes:read",
};

export const GET = withApiGuard(handler, options);
```
