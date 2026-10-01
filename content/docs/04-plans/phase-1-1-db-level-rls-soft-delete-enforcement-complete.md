---
publish: true
id: plan.phase-1-1-db-level-rls-soft-delete-enforcement-complete
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-1.1
   - rls
   - supabase
   - drizzle
   - postgresql
   - pnpm
   - soft-delete
status: completed
---

> **Milestone:** Drizzle connects as a non-superuser role (`app_runtime`). RLS is enforced at the database level — not by convention. Soft-delete filtering, user-data isolation, and hard-delete prevention are guaranteed by the database regardless of what application code does.
> **Learning payoff:** PostgreSQL roles, RLS enforcement vs. convention, trigger functions, migration journal mechanics, connection pooling and session variable scoping.
> **Completed:** May 2026

| #      | Task                                                                                                                           | Complexity | Learning | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ------ |
| 1.1.1  | Create `app_runtime` PostgreSQL role via Supabase SQL Editor (not in git — contains password)                                  | 🟢         | 🗄️ 🔐    | ✅     |
| 1.1.2  | Create migration `0001_app_runtime_grants.sql` — GRANT + ALTER DEFAULT PRIVILEGES                                              | 🟡         | 🗄️ 🔐    | ✅     |
| 1.1.3  | Create migration `0002_profiles_rls_policy.sql` — formalize `profiles` RLS policy in version control                           | 🟡         | 🗄️ 🔐    | ✅     |
| 1.1.4  | Create migration `0003_soft_delete_trigger_fns.sql` — shared `enforce_soft_delete()` and `block_update_on_deleted()` functions | 🟡         | 🗄️       | ✅     |
| 1.1.5  | Register all three migrations in `meta/_journal.json` with increasing `when` timestamps                                        | 🟢         | 🗄️       | ✅     |
| 1.1.6  | Run `pnpm db:migrate` — apply all three migrations                                                                             | 🟢         | 🗄️       | ✅     |
| 1.1.7  | Drop the dashboard-created `profiles` policy that predated version-controlled migrations                                       | 🟢         | 🗄️       | ✅     |
| 1.1.8  | Update `DATABASE_URL` in `.env.local` to use `app_runtime` credentials (pooler, port 6543)                                     | 🟢         | 🔐       | ✅     |
| 1.1.9  | Fix `withRLS` — wrap in `db.transaction()` so `set_config` is properly transaction-scoped                                      | 🔴         | 🗄️ 🔐    | ✅     |
| 1.1.10 | Verify: `pg_roles`, `role_table_grants`, `pg_policies` queries confirm setup; app loads after `DATABASE_URL` change            | 🟢         |          | ✅     |

**Phase 1.1 Exit Criteria:** ✅ All met.

- `app_runtime` role exists with `SELECT/INSERT/UPDATE/DELETE` on all public tables
- `DEFAULT PRIVILEGES` ensures future tables are auto-granted
- `profiles` RLS policy is in version control and enforced
- `withRLS` wraps queries in a real transaction — no session variable leakage
- Trigger functions `enforce_soft_delete()` and `block_update_on_deleted()` exist, ready to bind in Phase 3+

**Implementation notes:**

- `SET ROLE` in Supabase SQL Editor is restricted — cannot be used to test role-based access. Verify via `pg_roles`, `information_schema.role_table_grants`, and `pg_policies`. True end-to-end test is the running application.
- Migration `when` timestamps must be strictly increasing. Always base new timestamps on the previous entry.
- `db:generate` is NOT run for hand-written SQL migrations. Custom SQL goes straight to `db:migrate`.
- Two policies existed on `profiles` after migration — the original dashboard policy had a different name and was not dropped by the migration. Required a manual `DROP POLICY` afterward.
- Trigger functions defined now (not deferred to Phase 3) so feature migrations only need `CREATE TRIGGER` bindings.

---
