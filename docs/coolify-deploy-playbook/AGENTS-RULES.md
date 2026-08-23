# Coolify Deployment Rules (embed in AGENTS.md / CLAUDE.md / CONTEXT.md)

> Copy this block verbatim into every agent contract file at the root of any
> project that deploys to Coolify. Agents only follow rules they can see in their context files.

## Deployment (Coolify) — MANDATORY RULES

Source of truth: https://github.com/pixarusemperor/coolify-deploy-playbook

This project auto-deploys to production on push to the deploy branch via GitHub Actions → Coolify.

### Official Documentation References
- **Coolify Docs**: https://coolify.io/docs
- **Coolify API Reference**: https://coolify.io/docs/api-reference
- **Coolify Deployments & Webhooks**: https://coolify.io/docs/knowledge-base/applications/deployments
- **Coolify Server Auto-Cleanup**: https://coolify.io/docs/knowledge-base/server/automated-cleanup
- **GitHub Container Registry (GHCR)**: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **GitHub Actions Secrets**: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions

### Before deploying

1. **Read the env contract first** (`.env.example`, `lib/env.ts`, `src/env.ts`, or equivalent). A `required()` var missing in prod = 100% of requests return 500 while the container shows "healthy" — TCP healthchecks cannot see app-level validation failures.
2. **Set ALL required env vars BEFORE the first deploy.**
3. **Never retry failed deploys blindly.** Diagnose from deployment/build logs first.
4. **Never push to the deploy branch with failing typecheck, lint, or tests.**

### While deploying

5. **One deploy at a time** — the workflow concurrency group enforces this; never trigger concurrent manual API deploys while a workflow run is active.
6. **Poll to completion** — green means deployment status = `finished`, not merely triggered.

### Hard limits — NEVER

7. No destructive system or volume pruning on shared infrastructure (`docker system prune -af`, `docker volume prune`). Volumes hold database states.
8. No stopping, pausing, or deleting other apps; no reassigning other apps' domains.
9. No changing repo visibility without explicit user confirmation.
10. No logging or committing API tokens, private keys, or credentials.

### If things break

11. **Panel down ≠ rebuild.** Follow the recovery runbook in order: disk → database container (`coolify-db`) → panel container (`coolify`) → application.
12. **Document incidents** in `docs/DIAGNOSTIC-AND-FIX.md` — facts and timestamps, appended, never deleted.
