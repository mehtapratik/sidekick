---
publish: true
id: plan.phase-1.task-1-12and1-13
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - supabase
   - api
   - authentication
   - nextjs
   - react
   - typescript
status: completed
---

**Next.js Route Groups:** Use `(auth)` route group to keep auth pages visually grouped without affecting the URL. `(auth)` does not appear in the URL — `/login` not `/(auth)/login`.

**Create `apps/web/src/app/(auth)/layout.tsx`:**

```tsx
export default function AuthLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <main
         style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
         }}
      >
         {children}
      </main>
   );
}
```

**`apps/web/src/app/(auth)/login/page.tsx`** — This is a Client Component (needs form interactivity):

```tsx
"use client";
import { useForm } from "@mantine/form";
import {
   TextInput,
   PasswordInput,
   Button,
   Paper,
   Title,
   Text,
   Anchor,
   Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { createBrowserClient } from "@sidekick/core/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
   const router = useRouter();
   const supabase = createBrowserClient();

   const form = useForm({
      initialValues: { email: "", password: "" },
      validate: {
         email: (v) => (/^\S+@\S+$/.test(v) ? null : "Invalid email"),
         password: (v) => (v.length >= 6 ? null : "Password too short"),
      },
   });

   async function handleSubmit(values: typeof form.values) {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
         notifications.show({ color: "red", message: error.message });
         return;
      }
      router.push("/dashboard");
      router.refresh();
   }

   return (
      <Paper withBorder shadow="md" p={30} w={420}>
         <Title order={2} mb="md">
            Sign in
         </Title>
         <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
               <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  {...form.getInputProps("email")}
               />
               <PasswordInput
                  label="Password"
                  {...form.getInputProps("password")}
               />
               <Button type="submit" fullWidth>
                  Sign in
               </Button>
               <Text ta="center" size="sm">
                  No account? <Anchor href="/signup">Sign up</Anchor>
               </Text>
            </Stack>
         </form>
      </Paper>
   );
}
```

**`apps/web/src/app/(auth)/signup/page.tsx`** — Same pattern, uses `supabase.auth.signUp()`:

```tsx
"use client";
// ... same imports as login

export default function SignupPage() {
   const router = useRouter();
   const supabase = createBrowserClient();

   const form = useForm({
      initialValues: { email: "", password: "" },
      validate: {
         email: (v) => (/^\S+@\S+$/.test(v) ? null : "Invalid email"),
         password: (v) =>
            v.length >= 8 ? null : "Password must be 8+ characters",
      },
   });

   async function handleSubmit(values: typeof form.values) {
      const { error } = await supabase.auth.signUp(values);
      if (error) {
         notifications.show({ color: "red", message: error.message });
         return;
      }
      // After signup, also create the profile row
      const {
         data: { user },
      } = await supabase.auth.getUser();
      if (user) {
         // This will fail silently if profile already exists — that's fine
         await fetch("/api/auth/profile", { method: "POST" });
      }
      router.push("/dashboard");
      router.refresh();
   }

   // ... same JSX as login but with sign-up copy
}
```

**`apps/web/src/app/api/auth/profile/route.ts`** — Server Route Handler that creates the `profiles` row after signup using the admin client:

```typescript
import { createServerClient } from "@sidekick/core/supabase/server";
import { createAdminClient } from "@sidekick/core/supabase/admin";
import { db } from "@sidekick/core/db";
import { profiles } from "@sidekick/core/db/schema";
import { NextResponse } from "next/server";

export async function POST() {
   const supabase = await createServerClient();
   const {
      data: { user },
   } = await supabase.auth.getUser();

   if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

   // Use withRLS to insert the profile row
   // (Or use admin client here since the user is newly created and has no profile yet)
   await db
      .insert(profiles)
      .values({
         id: user.id,
         email: user.email!,
      })
      .onConflictDoNothing(); // idempotent — safe to call multiple times

   return NextResponse.json({ ok: true });
}
```

> Note: `onConflictDoNothing()` makes this idempotent — if the profile already exists (e.g., double submit), it silently succeeds. This is important for reliability.

---
