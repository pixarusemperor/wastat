# Coolify Deploy Playbook

> **Single source of truth** for any coding agent that creates, deploys, or
> manages apps on Coolify via GitHub. Proven in production — every rule here
> exists because an agent broke a real deployment by violating it.
>
> **Canonical URL**: `https://github.com/pixarusemperor/coolify-deploy-playbook`
>
> Works across machines: reference it by URL, clone it, or paste the master
> prompt (PROMPT.md) into any coding agent before it starts work.

---

## What's in here

| File | Purpose |
|---|---|
| `PROMPT.md` | **The master prompt** — paste this into a coding agent at session start |
| `AGENTS-RULES.md` | The rules block to embed in AGENTS.md / CLAUDE.md / CONTEXT.md of any project |
| `templates/deploy.yml` | Proven GitHub Actions workflow (trigger + poll + concurrency) |
| `docs/guides/production-monorepo-deployment.md` | **Full-Stack Monorepo Guide** (Multi-stage Docker, Fastify + React, Cloudflare SSL) |
| `docs/setup-new-project.md` | Step-by-step app creation & secrets provisioning |
| `docs/runbooks/vps-recovery.md` | Step-by-step recovery when the panel/app goes down |
| `docs/INCIDENT-2026-08-21.md` | The full forensic record this playbook was learned from |

## The 30-second version

1. Agent reads `lib/env.ts` (or the project's env contract) BEFORE touching env vars
2. ALL env vars go to Coolify BEFORE the first deploy (post-deploy edits = full rebuild)
3. Check VPS disk (`df -h /`) — builds need ~3GB free; below that, free space first
4. One deploy at a time; poll status; read build logs on failure
5. NEVER: `docker system prune -af` / `docker volume prune` / touching other apps' domains or containers
6. Panel down? Follow the recovery runbook IN ORDER — do not rebuild blindly

Full details: `AGENTS-RULES.md`.

## How to use with a new project

1. Copy `PROMPT.md` content and give it to your coding agent (with your project's specifics filled in).
2. Copy `AGENTS-RULES.md` content into the project's `AGENTS.md` AND `CLAUDE.md` (and `CONTEXT.md` if it exists) — agents only follow rules they can see in their context files.
3. Copy `templates/deploy.yml` into `.github/workflows/deploy.yml` and fill in the branch name.
4. Follow `docs/setup-new-project.md` for the Coolify app creation + secrets steps.
5. For TypeScript monorepos, follow `docs/guides/production-monorepo-deployment.md`.

---

*Proven on: Coolify v4.1.2 · GCE Ubuntu 24.04 VPS · GitHub Actions · Next.js Dockerfile apps & Full-Stack TypeScript Monorepos (WaStat V2)*
