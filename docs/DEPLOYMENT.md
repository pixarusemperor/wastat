# Deployment — wastat on Coolify

Live URL: **https://wassflow.orizongroup.online** · Coolify panel: https://coolifyone.orizongroup.online

Every push to `main` auto-deploys: GitHub Actions (`deploy.yml`) → Coolify API → VPS builds the root `Dockerfile` and runs it. One container serves the API, Wasender webhooks, and the built web UI.

## One-time setup (already done unless noted)

1. ✅ Root `Dockerfile` — single container, port 3000, DB at `/app/data/wastat.db`, serves `/app/public` (web build) with SPA fallback.
2. ✅ `.github/workflows/deploy.yml` — triggers deploy + polls to `finished` after CI passes.
3. ✅ Playbook vendored at `docs/coolify-deploy-playbook/`; mandatory rules in `AGENTS.md`.
4. ⬜ Create the Coolify app via API (see `docs/coolify-deploy-playbook/docs/setup-new-project.md`):
   - `build_pack: dockerfile`, `dockerfile_location: /Dockerfile`, `base_directory: /`
   - `domains: https://wassflow.orizongroup.online` (scheme required)
   - `ports_exposes: 3000`
   - DNS A record must already point `wassflow` at the VPS.
5. ⬜ Set env vars in Coolify BEFORE first deploy:
   - `WASENDER_PAT` (session management later; not read by server yet)
   - `WASENDER_BASE_URL=https://www.wasenderapi.com/api`
   - R2 vars when V1.1 lands. `PORT`/`DB_PATH` have Dockerfile defaults — do not override.
6. ⬜ Repo secrets: `gh secret set COOLIFY_API_TOKEN / COOLIFY_APP_UUID / COOLIFY_BASE_URL`.

## Wasender webhook URL (after deploy)

```
https://wassflow.orizongroup.online/webhooks/wasender/{provider_session_id}
```

Header `x-webhook-signature` must equal the session's webhook secret (stored in our `sessions.webhook_secret`). Configure per session in the Wasender dashboard or via API.

## Verification

```bash
gh run watch --exit-status
curl -sk https://wassflow.orizongroup.online/health -o /dev/null -w '%{http_code}\n'
curl -sk https://wassflow.orizongroup.online/ -o /dev/null -w '%{http_code}\n'   # 200, serves UI
```

Incidents: append facts to `docs/DIAGNOSTIC-AND-FIX.md`. Recovery runbook: `docs/coolify-deploy-playbook/docs/runbooks/vps-recovery.md`.
