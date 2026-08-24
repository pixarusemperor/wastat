# Cursor Rules for WaStat V2

1. Always read `CONTEXT.md`, `TASKS.md`, and `docs/ARCHITECTURE.md` before starting a task.
2. Architecture:
   - Primary DB: Supabase PostgreSQL (19 tables live).
   - Storage: Cloudflare R2 (`@aws-sdk/client-s3`).
   - Anti-Ban: Spintax parser in `@wastat/shared`, 2h silence sweeper in `@wastat/server`.
   - UI: React Flow in `@wastat/web`.
3. Quality Gates:
   - Run `npm run typecheck` and `npm test` after any code edit.
   - 0 TypeScript errors allowed.
4. Never commit or log API keys or `.env` secrets.
