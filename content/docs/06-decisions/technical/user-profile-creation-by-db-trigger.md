---
publish: true
id: decision.technical.user-profile-creation-by-db-trigger
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - supabase
   - api
   - authentication
status: accepted
---

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
