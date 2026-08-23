# Coolify Deploy Playbook

> **Single source of truth** for any coding agent that creates, deploys, or
> manages apps on Coolify via GitHub Actions.
>
> **Canonical URL**: `https://github.com/pixarusemperor/coolify-deploy-playbook`
>
> Works across all projects and machines: reference it by URL, clone it, or paste the master
> prompt (`PROMPT.md`) into any coding agent before it starts work.

---

## What's in here

| File | Purpose |
|---|---|
| `PROMPT.md` | **The master prompt** — paste this into a coding agent at session start |
| `AGENTS-RULES.md` | The universal rules block to embed in `AGENTS.md` / `CLAUDE.md` / `CONTEXT.md` of any project |
| `templates/deploy.yml` | Parametrized GitHub Actions workflow (trigger + poll + concurrency) |
| `docs/persistent-token-setup.md` | **One-time token setup** guide (local persistence & repo sync) |
| `docs/setup-new-project.md` | Step-by-step application onboarding in Coolify |
| `docs/runbooks/vps-recovery.md` | Step-by-step recovery runbook |
| `docs/INCIDENT-2026-08-21.md` | Forensic record of past incidents and root-cause analysis |

## Official Documentation References

- **Coolify Docs**: https://coolify.io/docs
- **Coolify API Reference**: https://coolify.io/docs/api-reference
- **Coolify Deployments & Webhooks**: https://coolify.io/docs/knowledge-base/applications/deployments
- **Coolify Server Auto-Cleanup**: https://coolify.io/docs/knowledge-base/server/automated-cleanup
- **GitHub Container Registry (GHCR)**: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **GitHub Actions Secrets**: https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions

## The 30-second version

1. Read the project's env contract (`.env.example`, `lib/env.ts`, `src/env.ts`) BEFORE touching env vars.
2. Push all required environment variables to Coolify BEFORE triggering deployments.
3. Configure persistent Coolify token once (`docs/persistent-token-setup.md`) — no per-session token churn.
4. One deploy at a time; poll status until `finished`.
5. NEVER run destructive `docker system prune -af` or `docker volume prune` on shared servers.
6. Panel down? Follow the recovery runbook IN ORDER: disk → `coolify-db` → `coolify` → app.

## How to use with a new project

1. Copy `PROMPT.md` content and give it to your coding agent (with project specifics filled in).
2. Copy `AGENTS-RULES.md` content into the project's `AGENTS.md` and `CLAUDE.md`.
3. Copy `templates/deploy.yml` into `.github/workflows/deploy.yml` and set the deploy branch.
4. Follow `docs/setup-new-project.md` for Coolify app creation and secrets sync.
