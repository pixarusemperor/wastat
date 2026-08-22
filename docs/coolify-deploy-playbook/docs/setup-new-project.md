# Setup — New Project on Coolify (from scratch)

> The proven, ordered procedure. Every step validated in production
> (wadeskhybrid, 2026-08-21). Do the steps IN ORDER — reordering is what broke
> production the first time.

## Prerequisites

- [ ] Public GitHub repo with a working `Dockerfile` at the root
- [ ] DNS A record: `your-subdomain.example.com → VPS_IP` (TTL 300)
- [ ] Coolify API token (panel → Settings → API tokens; format `<id>|<hash>`)

## Step-by-step

### 1. Create the Coolify app via API (no UI needed)

```bash
curl -sk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "<PROJECT_UUID>",
    "environment_uuid": "<ENV_UUID>",
    "server_uuid": "<SERVER_UUID>",
    "name": "my-app",
    "build_pack": "dockerfile",
    "git_repository": "https://github.com/OWNER/REPO.git",
    "git_branch": "main",
    "domains": "https://my-subdomain.example.com",
    "ports_exposes": "3000",
    "ports_mappings": "3000:3000",
    "base_directory": "/",
    "dockerfile_location": "/Dockerfile",
    "is_auto_deploy_enabled": true,
    "is_force_https_enabled": true
  }' \
  "https://coolify.example.com/api/v1/applications/public"
```

Gotchas proven the hard way:
- `domains` MUST include the scheme (`https://...`) or validation fails.
- ALWAYS set `dockerfile_location` AND `base_directory` in the creation payload;
  `build_pack: dockerfile` alone leaves `dockerfile_location` null and the build
  uses the wrong path.
- Note the returned `uuid` — that's `COOLIFY_APP_UUID`.

### 2. Set ALL env vars NOW (before any deploy!)

One at a time (bulk endpoint rejects unknown fields):

```bash
curl -sk -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "VAR_NAME", "value": "value"}' \
  "https://coolify.example.com/api/v1/applications/$APP_UUID/envs"
```

- Multiline values (JSON creds) must be base64-encoded and decoded in an
  entrypoint script — raw newlines break the Dockerfile ARG injection.
- Client-visible vars (`NEXT_PUBLIC_*`) also need to exist as Build Variables if
  the Dockerfile reads them as ARGs.

### 3. Set GitHub repo secrets

```bash
gh secret set COOLIFY_API_TOKEN --repo OWNER/REPO --body "$TOKEN"
gh secret set COOLIFY_APP_UUID  --repo OWNER/REPO --body "$APP_UUID"
gh secret set COOLIFY_BASE_URL  --repo OWNER/REPO --body "https://coolify.example.com"
```

### 4. Add the deploy workflow

Copy `templates/deploy.yml` into `.github/workflows/deploy.yml`. Edit:
1. Header comment (project name)
2. `branches:` → your deploy branch
The workflow handles trigger + poll + concurrency automatically.

### 5. Install agent rules (before any agent works on this project)

Fetch and embed `AGENTS-RULES.md` from the playbook repo into the project's
`AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` (create missing ones). See PROMPT.md Step 0.

### 6. First deploy

```bash
git add .github/workflows/deploy.yml && git commit -m "ci: add coolify deploy workflow" && git push origin main
```

Watch it end-to-end:

```bash
gh run watch --exit-status   # green = deployment status reached 'finished'
curl -sk https://my-subdomain.example.com/ -o /dev/null -w '%{http_code}\n'
```

If red: STOP. Read build logs (runbook §5). Diagnose. Fix. Retry ONCE.

## Verification checklist

- [ ] Workflow run finished green (poll completed, not just triggered)
- [ ] Domain returns expected HTTP code (200/302)
- [ ] Container logs clean (`docker logs <container>` on the VPS)
- [ ] Agent rules embedded in AGENTS.md / CLAUDE.md / CONTEXT.md
