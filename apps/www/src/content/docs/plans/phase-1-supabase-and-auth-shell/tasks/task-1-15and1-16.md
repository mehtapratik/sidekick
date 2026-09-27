---
title: Task 1.15and1.16
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
  - supabase
  - authentication
  - nextjs
  - react
  - mantine
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-15and1-16
sourcePath: >-
  sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-15and1-16.md
wordCount: 214
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**`apps/web/src/app/(app)/layout.tsx`** — Protected layout. In Next.js App Router, you can validate the session in a layout's server component:

```tsx
import { createServerClient } from "@sidekick/core/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "./app-shell";

export default async function AppLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   const supabase = await createServerClient();
   const {
      data: { user },
   } = await supabase.auth.getUser();

   if (!user) redirect("/login"); // Belt-and-suspenders — middleware handles this too

   return <AppShell user={user}>{children}</AppShell>;
}
```

**`apps/web/src/app/(app)/app-shell.tsx`** — Client Component for interactive sidebar/header:

```tsx
"use client";
import {
   AppShell as MantineAppShell,
   NavLink,
   Group,
   Text,
   Button,
} from "@mantine/core";
import { createBrowserClient } from "@sidekick/core/supabase/browser";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export function AppShell({
   user,
   children,
}: {
   user: User;
   children: React.ReactNode;
}) {
   const router = useRouter();
   const supabase = createBrowserClient();

   async function handleSignOut() {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
   }

   return (
      <MantineAppShell
         header={{ height: 60 }}
         navbar={{ width: 240, breakpoint: "sm" }}
         padding="md"
      >
         <MantineAppShell.Header>
            <Group h="100%" px="md" justify="space-between">
               <Text fw={700}>Sidekick</Text>
               <Button variant="subtle" size="sm" onClick={handleSignOut}>
                  Sign out
               </Button>
            </Group>
         </MantineAppShell.Header>
         <MantineAppShell.Navbar p="md">
            <NavLink label="Dashboard" href="/dashboard" />
            {/* More nav items added in future phases */}
         </MantineAppShell.Navbar>
         <MantineAppShell.Main>{children}</MantineAppShell.Main>
      </MantineAppShell>
   );
}
```

**`apps/web/src/app/(app)/dashboard/page.tsx`:**

```tsx
import { createServerClient } from "@sidekick/core/supabase/server";
import { Text, Title } from "@mantine/core";

export default async function DashboardPage() {
   const supabase = await createServerClient();
   const {
      data: { user },
   } = await supabase.auth.getUser();

   return (
      <>
         <Title order={2}>Dashboard</Title>
         <Text mt="sm" c="dimmed">
            Welcome, {user?.email}
         </Text>
      </>
   );
}
```

---
