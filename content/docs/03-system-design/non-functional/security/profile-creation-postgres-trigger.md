---
publish: true
id: system-design.non-functional.security.profile-creation-postgress-trigger
created: 2026-09-19
updated: 2026-10-14
kind: spec
aliases:
   - profile-creation-postgress-trigger-syml
version: 1.1.0
tags:
   - system-design
   - security
   - postgresql
   - api
   - authentication
---

[[user-profile-creation-by-db-trigger|Why?]]

\> User profiles are created via a Postgres trigger on `auth.users`, not via an API route. This ensures reliability across auth providers and prevents race conditions, as profile creation becomes part of the same database transaction.

\> Prefix tables with `public.` while referencing them in triggers and functions. A function resolves unqualified names through the `search_path` of the role running it, not the schema of the table that fired the trigger. Supabase sets `search_path=auth` for `supabase_auth_admin`, the role that inserts into `auth.users`, so an unqualified `INSERT INTO profiles` would look for `auth.profiles`, which does not exist.

\> The function and trigger are versioned in migration `0005_profile_creation_trigger.sql`; never edit them in the Supabase SQL editor.

\> The function is `SECURITY DEFINER` so it runs as its owner (`postgres`) instead of `supabase_auth_admin`, which has no `INSERT` privilege on `public.profiles` and no `BYPASSRLS`. The insert succeeds despite `FORCE ROW LEVEL SECURITY` on `profiles` only because `postgres` has `BYPASSRLS`; no user context exists during signup.

\> Every `SECURITY DEFINER` function must pin `SET search_path = ''` and schema-qualify every object, so a caller-controlled search path cannot redirect a privileged function to a lookalike object.

\> The trigger runs in the same transaction as the `auth.users` insert. If it fails, signup fails and the user row is rolled back. Known limit: `auth.users.email` is nullable but `profiles.email` is `NOT NULL`, so phone or anonymous sign-ins would fail until that is addressed.
