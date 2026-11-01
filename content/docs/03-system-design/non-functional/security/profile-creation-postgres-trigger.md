---
publish: true
id: system-design.non-functional.security.profile-creation-postgress-trigger
title: Profile Creation Postgres Trigger
created: 2026-09-19
updated: 2026-11-01
kind: spec
aliases:
   - profile-creation-postgress-trigger-syml
version: 1.2.0
tags:
   - system-design
   - security
   - postgresql
   - api
   - authentication
---

\> User profiles are created via a Postgres trigger on `auth.users`, not via an API route. This ensures reliability across auth providers and prevents race conditions, as profile creation becomes part of the same database transaction.

\> Prefix tables with `public.` while referencing them in triggers and functions. A function resolves unqualified names through the `search_path` of the role running it, not the schema of the table that fired the trigger. Supabase sets `search_path=auth` for `supabase_auth_admin`, the role that inserts into `auth.users`, so an unqualified `INSERT INTO profiles` would look for `auth.profiles`, which does not exist.

\> The function and trigger are versioned in migration `0005_profile_creation_trigger.sql`; never edit them in the Supabase SQL editor.

\> The function is `SECURITY DEFINER` so it runs as its owner (`postgres`) instead of `supabase_auth_admin`, which has no `INSERT` privilege on `public.profiles` and no `BYPASSRLS`. The insert succeeds despite `FORCE ROW LEVEL SECURITY` on `profiles` only because `postgres` has `BYPASSRLS`; no user context exists during signup.

\> Every `SECURITY DEFINER` function must pin `SET search_path = ''` and schema-qualify every object, so a caller-controlled search path cannot redirect a privileged function to a lookalike object.

\> The trigger runs in the same transaction as the `auth.users` insert. If it fails, signup fails and the user row is rolled back. Known limit: `auth.users.email` is nullable but `profiles.email` is `NOT NULL`, so phone or anonymous sign-ins would fail until that is addressed.

Supabase auth API inserts a row into `auth.users` when user signs up. We will have a trigger setup on `auth.users` table that automatically calls `public.create_profile_for_new_user()` function to insert a corresponding row into `public.profiles` table.

```sql
CREATE FUNCTION public.create_profile_for_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, created_at)
    VALUES (NEW.id, NEW.email, NOW());

    RETURN NEW;
  END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();
```

The original plan included a `POST /api/auth/profile` route for this purpose. That route was dropped.

## Why?

\> **Works for all auth providers automatically.** An API route would need to be called explicitly after every sign-up — and separately wired up for every auth provider (email/password, OAuth, magic link, SSO). Forgetting to handle a new provider means users can authenticate but have no profile. The trigger fires unconditionally on every `auth.users` insert, regardless of provider.

\> **Cannot fail silently after auth succeeds.** With an API route, auth could succeed but the profile creation API call could fail (network error, bug, deployment issue), leaving the user in a broken state. The trigger executes in the same database transaction as the `auth.users` insert — if profile creation fails, the whole operation fails cleanly before the user is considered signed up.

\> **No app-level orchestration.** No route handler, no `useEffect`, no post-sign-up redirect-then-create flow. The database handles it.

\> **Simpler codebase.** One less API route. One less thing that can drift or be forgotten when adding a new auth provider.

## Decision History

- 2026-09-19 · accepted · User Profile Creation by DB Trigger
