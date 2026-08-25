# Postgres Port — WaStat V2

Goal: move the app runtime (engine/api/scheduler/media) from `better-sqlite3` to
Supabase PostgreSQL (`postgres.js` + the session-pooler `DATABASE_URL`), slice by
slice, without ever taking production down. Until the last slice lands, production
keeps running on the SQLite fallback; ported slices read/write Postgres directly.

## The seam (already in place)

- `DbClient` (`packages/server/src/db/client.ts`) carries **both** providers:
  `sql` (postgres.js) when Supabase env vars are present, plus a schema-applied
  `sqlite` handle that `index.ts` guarantees in every mode.
- `buildApp(db: DbClient | BetterSqlite3.Database, …)` accepts either; raw sqlite
  dbs (tests) are wrapped. Unported modules receive the sqlite handle; ported
  modules receive the `DbClient`.
- Ported modules use the async helpers from `db/client.ts`:
  - `queryAll(db, sql, params)` → rows
  - `queryGet(db, sql, params)` → first row
  - `queryRun(db, sql, params)` → `{ lastInsertRowid }` (appends `RETURNING id` on pg)

### Helper contract (read before porting a module)

1. **Placeholders**: write `?` in the SQL text; the helper rewrites to `$1..$n`
   for postgres.js. Never put `?` inside a string literal.
2. **Aliases**: Postgres lowercases unquoted identifiers — always write aliases as
   `AS "camelCase"` (double quotes work identically on SQLite).
3. **Types**: pg returns `created_at`/timestamps as `Date` (JSON-serializes to ISO
   string); sqlite returns TEXT. Don't assert on the runtime type.
4. **Sequences**: after inserting explicit ids (migrations/seed), run
   `setval(pg_get_serial_sequence(...))` — see `scripts/migrate-prod-to-supabase.mjs`.
5. **Sync → async**: ported routes are already `async` handlers; the engine/scheduler
   are sync today and must become async (callers already use `void fn()`).

## Slice inventory

| # | Slice | Files | Status |
|---|-------|-------|--------|
| 0 | Seam: DbClient through buildApp, query helpers, sqlite attach | `app.ts`, `index.ts`, `db/client.ts` | ✅ done |
| 1 | Media assets | `media.ts` (`/api/media*`) | ✅ done + verified vs real Supabase/R2 |
| 2 | Sessions + Wasender sync | `api.ts` sessions routes, `app.ts` webhook session bits, `wasender-admin.ts` upsert, `index.ts` getApiKey | ⬜ |
| 3 | Workflows + nodes/edges | `api.ts` workflow CRUD (biggest api slice) | ⬜ |
| 4 | Contacts + attributes/tags | `api.ts` contacts routes | ⬜ |
| 5 | Messages + events + webhooks | `app.ts` webhook handlers, engine message inserts | ⬜ |
| 6 | Executions + jobs | `engine.ts`, `scheduler.ts` (sync → async conversion) | ⬜ hardest |
| 7 | Experiments / funnel / leftovers | `api.ts` | ⬜ |
| 8 | Seed + teardown | `seed-defaults.ts`, remove SQLite fallback, drop `DB_PATH`/`openDb` path | ⬜ |

Order note: 2–4 are route-level and mechanical; 5–6 require the engine async
conversion (the real work). After slice 6, production can flip fully to Postgres;
slice 8 removes the sqlite crutch.

## Verification pattern (per slice)

1. Ported module unit path still green on sqlite (existing tests must pass — they
   run against the sqlite side of the seam).
2. Boot the server with real pooler creds (Supabase mode), exercise the HTTP routes,
   assert rows land in Supabase via PostgREST (service role key), clean up after.
   See the media-slice verification for the template.
3. `npm run typecheck && npm test && npm run build`.

## Notes / gotchas found so far

- Postgres unique indexes treat `NULL`s as distinct — `ON CONFLICT … DO NOTHING`
  will NOT dedupe rows whose constraint column is NULL (e.g. `workflow_edges.handle`).
  Prefer delete-then-insert for idempotent migrations.
- `workflows.session_id` was missing from `supabase-schema.sql` — now added (and
  applied live via `ALTER TABLE`).
- Supabase `media_assets` contains 4 pre-existing rows from earlier local tooling;
  they will appear in `/api/media` once the media slice deploys. Clean them up if
  unwanted.
