# Agent Instructions

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `pixarusemperor/wastat` (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Deployment (Coolify) — MANDATORY RULES

Source of truth: `docs/coolify-deploy-playbook/AGENTS-RULES.md` (vendored from
https://github.com/pixarusemperor/coolify-deploy-playbook). This project
auto-deploys to production on every push to `main`
(GitHub Actions → Coolify API → VPS builds and runs → https://wassflow.orizongroup.online).

### Before deploying

1. **Read the env contract first** (`.env.example`, server env reads). A required var missing in prod = 100% of requests return 500 while the container shows "healthy".
2. **Set ALL env vars BEFORE the first deploy** — post-deploy env edits trigger a full Docker rebuild on a disk-constrained VPS.
3. **Check disk before any build** (`df -h /` on the VPS): builds need ~3GB transient free. Free space using the SAFE ORDER in `docs/coolify-deploy-playbook/docs/runbooks/vps-recovery.md` §3. Never jump to destructive commands.
4. **Never retry failed deploys blindly.** Diagnose from build logs first; each failed build leaves cache that makes the next one worse.

### While deploying

5. **One deploy at a time** — the workflow's concurrency group enforces this; never trigger manual API deploys while a workflow run is live.
6. **Poll to completion** — green means deployment status = `finished`, not merely triggered.

### Hard limits — NEVER

7. No `docker system prune -af`, no `docker volume prune`, no removing images/containers/volumes you did not create in this session.
8. No stopping, pausing, or deleting other apps; no touching other apps' domains.
9. No changing repo visibility without asking.
10. No pushes to the deploy branch with failing typecheck/lint/tests.

### If things break

11. **Panel down ≠ rebuild.** Follow `docs/coolify-deploy-playbook/docs/runbooks/vps-recovery.md` IN ORDER: disk → coolify-db → panel → app.
12. **Document incidents** in `docs/DIAGNOSTIC-AND-FIX.md` — facts and timestamps, appended, never deleted.
