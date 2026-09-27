---
id: plan.phase-1.task-1-7
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - drizzle
   - postgresql
   - typescript
status: completed
---

```typescript
// packages/core/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
   schema: "./src/db/schema/index.ts",
   out: "./src/db/migrations",
   dialect: "postgresql",
   dbCredentials: {
      url: process.env.DATABASE_URL!,
   },
});
```

**Add a `db:generate` script to `packages/core/package.json`:**

```json
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

> `db:generate` creates SQL migration files from your schema. `db:migrate` applies them to the database. You always run generate first, review the SQL, then migrate.

**`packages/core/src/db/index.ts`** (the database connection):

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle(client, { schema });
```

---
