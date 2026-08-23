# MASTER PROMPT — Coolify/GitHub Deployment Rules

> Give this to ANY coding agent at the START of a session, before it writes
> code or deploys. Fill in the `<<<...>>>` placeholders. The agent must read
> this repo's files and install the rules into the project's context files
> BEFORE starting work.

---

You are working on a project that deploys to production via GitHub → Coolify.
Before writing any code, you MUST complete the setup steps below.

**Project**: <<<PROJECT NAME>>>
**GitHub repo**: <<<OWNER/REPO>>>
**Deploy branch**: <<<main>>>
**Production domain**: <<<https://app.example.com>>>
**Coolify panel**: <<<https://coolify.example.com>>>
**Playbook repo (read it first)**: https://github.com/pixarusemperor/coolify-deploy-playbook

### Official Documentation References
- **Coolify Docs**: https://coolify.io/docs
- **Coolify API Reference**: https://coolify.io/docs/api-reference
- **Coolify Deployments & Webhooks**: https://coolify.io/docs/knowledge-base/applications/deployments
- **Coolify Server Auto-Cleanup**: https://coolify.io/docs/knowledge-base/server/automated-cleanup
- **GitHub Container Registry (GHCR)**: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **GitHub Actions Secrets**: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions

---

## Step 0 — Install the rules into the project (do this FIRST, before coding)

1. Fetch the playbook rules:
   ```bash
   curl -sL https://raw.githubusercontent.com/pixarusemperor/coolify-deploy-playbook/main/AGENTS-RULES.md -o /tmp/agents-rules.md
   ```
2. Append the rules to EVERY agent contract file the project has — typically
   `AGENTS.md`, `CLAUDE.md`, and `CONTEXT.md` at the repo root (create missing
   ones). Agents only obey rules present in their context files; if the rules
   are only in a docs folder, they will be ignored.
3. Commit and push this as your FIRST commit, before any feature work:
   `docs: install Coolify deployment rules from playbook`

## Step 1 — Read the env contract

- Read the project's env validation file (`.env.example`, `lib/env.ts`, `src/env.ts`,
  or equivalent) BEFORE touching any environment variable.
- List which variables are REQUIRED in production. A required-but-missing var
  typically causes every request to return 500 while the container reports
  "healthy" (TCP healthchecks cannot see application-level validation failures).
- If the project does not use a service (e.g. a legacy provider), make its vars
  OPTIONAL with a safe default — never leave required vars unset.

## Step 2 — Set ALL env vars BEFORE the first deploy

- Push every environment variable to Coolify via the API or panel BEFORE
  triggering the first deployment.
- Ensure client-visible / build-time variables (e.g. `NEXT_PUBLIC_*`) are set as
  Build Variables in Coolify if the Dockerfile reads them as ARGs.

## Step 3 — Persistent Token & Credentials

- Reuse the persistent master Coolify token stored in `~/.config/coolify/credentials.env`
  and configured in GitHub Secrets (`COOLIFY_API_TOKEN`, `COOLIFY_BASE_URL`).
- See `docs/persistent-token-setup.md` for full token persistence guidance.

## Step 4 — Deploy through the workflow, one at a time

- Use the proven workflow: copy `templates/deploy.yml` from the playbook into
  `.github/workflows/deploy.yml`, set the branch name, and ensure repo
  secrets are populated (`COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID`, `COOLIFY_BASE_URL`).
- The workflow triggers the deploy AND polls until finished/failed, so every
  commit gets a real pass/fail status. Do not bypass it with manual API deploys
  while a workflow run is in progress (the concurrency group enforces one
  deploy at a time — respect it).
- If a deploy FAILS: stop. Read the build/deployment logs. Diagnose. Fix. THEN retry once.

## Step 5 — If production breaks

- Follow `docs/runbooks/vps-recovery.md` from the playbook IN ORDER:
  disk → database container (`coolify-db`) → panel container (`coolify`) → application. Do not skip to rebuilds.
- Document what happened (facts + timestamps) in the project's
  `docs/DIAGNOSTIC-AND-FIX.md`. Append, never delete.

## Hard limits (violating these = stop working immediately)

1. Never run destructive Docker commands (`docker system prune -af`, `docker volume prune`) on shared infrastructure.
2. Never stop, pause, delete, or reassign domains of apps you did not create in this session.
3. Never change repository visibility (public↔private) without asking.
4. Never push to the deploy branch without green typecheck/lint/tests.
5. Never log secrets, tokens, or credentials.

## Definition of done for any deploy

- Workflow run green (not just "triggered" — actually `finished`).
- Production domain returns the expected HTTP status.
- Container logs show no startup errors.
- If anything changed in env vars: documented in the project's env docs.
