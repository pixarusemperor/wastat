# Deployment — wastat on Coolify

- **Live URL**: https://wassflow.orizongroup.online
- **Coolify Panel**: https://coolifyone.orizongroup.online
- **Master Playbook**: [docs/coolify-deploy-playbook/](file:///home/stevenjossu/wastat/docs/coolify-deploy-playbook/) (Canonical repo: https://github.com/pixarusemperor/coolify-deploy-playbook)

Every push to `main` auto-deploys: GitHub Actions (`.github/workflows/deploy.yml`) → Coolify API → Container runtime. One container serves the Fastify API, Wasender webhooks, and the built React web UI.

---

## Live Configuration

- **Coolify App**: `wastat` (`kscggalxinzezf0f9u8b5wbn`)
- **Server**: `localhost` (Project: WASPOSTER / production)
- **Domain**: `https://wassflow.orizongroup.online`
- **Exposed Port**: 3000
- **Database**: Supabase PostgreSQL (production datastore; see [ADR 0005](adr/0005-supabase-and-cloudflare-r2-architecture.md)). SQLite is only a local-dev fallback.
- **Media Storage**: Cloudflare R2 (primary). Local disk is only a local-dev fallback.
- **Environment Variables**:
  - `WASENDER_BASE_URL=https://www.wasenderapi.com/api`
  - `WASENDER_PAT` (Account Personal Access Token)
  - `PORT=3000` (default)
  - `PUBLIC_BASE_URL=https://wassflow.orizongroup.online`
  - Supabase PostgreSQL (required in production):
    - `SUPABASE_URL` (Supabase project URL)
    - `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` (service-role / anon keys)
    - `DATABASE_URL` (Postgres connection string)
  - Cloudflare R2 (required in production for media):
    - `R2_ACCOUNT_ID` (Cloudflare R2 Account ID)
    - `R2_BUCKET_NAME` (Cloudflare R2 Bucket Name)
    - `R2_ACCESS_KEY_ID` (Cloudflare R2 Access Key ID)
    - `R2_SECRET_ACCESS_KEY` (Cloudflare R2 Secret Access Key)
    - `R2_PUBLIC_URL` (Cloudflare R2 public custom domain / CDN URL)
  - Local fallbacks (dev only, not used in production):
    - `DB_PATH=/app/data/wastat.db` (SQLite path when no Supabase vars configured)
    - `MEDIA_DIR=/app/data/media` (local media dir when no R2 vars configured)

---

## Setup & CI/CD Workflow

1. Root `Dockerfile` — single container, Node 22 runtime, port 3000, serves `/app/public` with SPA fallback. State persists in Supabase PostgreSQL and media in Cloudflare R2, so no local data volume is required for the database or media.
2. `.github/workflows/deploy.yml` — runs CI (`ci.yml`: lint, typecheck, tests), triggers deployment in Coolify, and polls until `finished`.
3. Persistent Token Setup — uses the global master token stored in `~/.config/coolify/credentials.env` and synced to repo secrets (`COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`, `COOLIFY_BASE_URL`).

---

## Wasender Webhook Endpoint

```
https://wassflow.orizongroup.online/webhooks/wasender/{provider_session_id}
```

Header `x-webhook-signature` must match the session's webhook secret configured in the Wasender dashboard or synced via API.

---

## Verification & Health Check

```bash
# Watch GitHub Actions deployment
gh run watch --exit-status

# Verify API health check
curl -sk https://wassflow.orizongroup.online/health -o /dev/null -w '%{http_code}\n'

# Verify Web UI
curl -sk https://wassflow.orizongroup.online/ -o /dev/null -w '%{http_code}\n'
```
