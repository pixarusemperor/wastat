# Setup — New Project on Coolify

> The standardized procedure for onboarding and deploying a new application to Coolify via GitHub Actions.

---

## Official Documentation References

- **Coolify API Reference**: [https://coolify.io/docs/api-reference](https://coolify.io/docs/api-reference)
- **Coolify Application Management**: [https://coolify.io/docs/knowledge-base/applications](https://coolify.io/docs/knowledge-base/applications)
- **Coolify Deployments & Webhooks**: [https://coolify.io/docs/knowledge-base/applications/deployments](https://coolify.io/docs/knowledge-base/applications/deployments)
- **GitHub Actions Secrets**: [https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)

---

## Prerequisites

- [ ] GitHub repository with a working `Dockerfile` at the root (or pre-built container image)
- [ ] DNS A record pointing `<APP_SUBDOMAIN>` to the Coolify server IP (TTL 300)
- [ ] Coolify Master API Token (see [`persistent-token-setup.md`](./persistent-token-setup.md))

---

## Step-by-Step

### 1. Create the Application in Coolify

You can create the application via the Coolify Web UI or via the API:

```bash
curl -sk -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "<PROJECT_UUID>",
    "environment_uuid": "<ENV_UUID>",
    "server_uuid": "<SERVER_UUID>",
    "name": "<APP_NAME>",
    "build_pack": "dockerfile",
    "git_repository": "https://github.com/<OWNER>/<REPO>.git",
    "git_branch": "main",
    "domains": "https://<APP_DOMAIN>",
    "ports_exposes": "3000",
    "ports_mappings": "3000:3000",
    "base_directory": "/",
    "dockerfile_location": "/Dockerfile",
    "is_auto_deploy_enabled": true,
    "is_force_https_enabled": true
  }' \
  "${COOLIFY_BASE_URL}/api/v1/applications/public"
```

> [!NOTE]
> - `domains` MUST include the scheme (`https://...`).
> - Save the returned `uuid` — this is `COOLIFY_APP_UUID`.

---

### 2. Set Environment Variables BEFORE First Deploy

Push required environment variables to Coolify via API or panel:

```bash
curl -sk -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "VAR_NAME", "value": "value"}' \
  "${COOLIFY_BASE_URL}/api/v1/applications/$APP_UUID/envs"
```

- Multiline values (such as JSON certificates/keys) should be base64-encoded and decoded in an entrypoint script.
- Client-visible variables (e.g. `NEXT_PUBLIC_*`) should also be set as Build Variables if the Dockerfile reads them as build ARGs.

---

### 3. Set GitHub Repository Secrets

Configure secrets on the target repository using `gh secret set`:

```bash
gh secret set COOLIFY_API_TOKEN --repo OWNER/REPO --body "$COOLIFY_API_TOKEN"
gh secret set COOLIFY_APP_UUID  --repo OWNER/REPO --body "$APP_UUID"
gh secret set COOLIFY_BASE_URL  --repo OWNER/REPO --body "$COOLIFY_BASE_URL"
```

*(See [`persistent-token-setup.md`](./persistent-token-setup.md) for automated multi-repo syncing.)*

---

### 4. Add the GitHub Actions Deploy Workflow

Copy `templates/deploy.yml` from the playbook into `.github/workflows/deploy.yml` in the project:

```bash
mkdir -p .github/workflows
cp path/to/coolify-deploy-playbook/templates/deploy.yml .github/workflows/deploy.yml
```

---

### 5. Install Agent Rules

Embed `AGENTS-RULES.md` into the project's root `AGENTS.md` and `CLAUDE.md`:

```bash
curl -sL https://raw.githubusercontent.com/pixarusemperor/coolify-deploy-playbook/main/AGENTS-RULES.md >> AGENTS.md
```

---

### 6. First Deploy & Verification

```bash
git add .github/workflows/deploy.yml AGENTS.md && git commit -m "ci: configure coolify deployment" && git push origin main
```

Watch the workflow run to completion:

```bash
gh run watch --exit-status
curl -sk https://<APP_DOMAIN>/ -o /dev/null -w '%{http_code}\n'
```

---

## Verification Checklist

- [ ] GitHub Actions workflow finished with status `finished` (green checkmark)
- [ ] Application domain returns expected HTTP status (e.g. 200)
- [ ] Container logs show no boot/runtime errors
- [ ] Agent deployment rules embedded in project's context files
