---
title: Task 1.14
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: built
version: 1.0.0
tags:
  - plan
  - phase-1
  - task
  - react
  - pnpm
  - mantine
  - css
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-14
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-14.md
wordCount: 183
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why Mantine:** Pre-built accessible component library with a form library (`@mantine/form`) and notification system. Significantly faster to build good-looking UIs than writing everything from scratch.

**Install in `apps/web`:**

```bash
pnpm add --filter web @mantine/core @mantine/hooks @mantine/form @mantine/notifications
pnpm add --filter web postcss postcss-preset-mantine postcss-simple-vars
```

**Create `apps/web/postcss.config.cjs`:**

```js
module.exports = {
   plugins: {
      "postcss-preset-mantine": {},
      "postcss-simple-vars": {
         variables: {
            "mantine-breakpoint-xs": "36em",
            "mantine-breakpoint-sm": "48em",
            "mantine-breakpoint-md": "62em",
            "mantine-breakpoint-lg": "75em",
            "mantine-breakpoint-xl": "88em",
         },
      },
   },
};
```

**Update `apps/web/src/app/layout.tsx`** to wrap with Mantine's `ColorSchemeScript` and `MantineProvider`. This must be a Server Component that imports a `Providers` Client Component (because `MantineProvider` needs the React context which requires `'use client'`):

Create `apps/web/src/app/providers.tsx`:

```tsx
"use client";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
   return (
      <MantineProvider>
         <Notifications />
         {children}
      </MantineProvider>
   );
}
```

Update `apps/web/src/app/layout.tsx`:

```tsx
import { ColorSchemeScript } from "@mantine/core";
import { Providers } from "./providers";

export const metadata = { title: "Sidekick" };

export default function RootLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <html lang="en">
         <head>
            <ColorSchemeScript />
         </head>
         <body>
            <Providers>{children}</Providers>
         </body>
      </html>
   );
}
```

---
