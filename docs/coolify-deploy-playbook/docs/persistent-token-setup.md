# Persistent Coolify Token Setup & Automation Guide

> **Single Source of Truth** for configuring a permanent, reusable Coolify API token across developer environments, coding agents, and CI/CD pipelines without re-generating tokens per session or project.

---

## Architecture Overview

Instead of creating a new API token for every project or session, modern Coolify setups use a **3-Layer Persistence Model**:

```mermaid
flowchart TD
    subgraph Layer1 ["Layer 1: Coolify Instance"]
        A[Create 1 Master API Token<br/>Format: <ID>|<HASH>]
    end

    subgraph Layer2 ["Layer 2: Local Developer & Agent Environment"]
        A --> B[~/.config/coolify/credentials.env<br/>~/.bashrc auto-export]
        B --> C[Coding Agents & Local CLI Scripts<br/>Read automatically with zero prompting]
    end

    subgraph Layer3 ["Layer 3: GitHub Repositories"]
        B --> D[One-Command Secret Sync via gh CLI<br/>or GitHub Organization Secrets]
        D --> E[Repo 1: CI/CD Deploy Workflow]
        D --> F[Repo 2: CI/CD Deploy Workflow]
        D --> G[Repo N: Future Projects]
    end
```

---

## Official Documentation References

- **Coolify API Reference & Authentication**: [https://coolify.io/docs/api-reference](https://coolify.io/docs/api-reference)
- **Coolify Deployments & Webhooks**: [https://coolify.io/docs/knowledge-base/applications/deployments](https://coolify.io/docs/knowledge-base/applications/deployments)
- **GitHub Actions Secrets Management**: [https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
- **GitHub CLI Secrets Command (`gh secret set`)**: [https://cli.github.com/manual/gh_secret_set](https://cli.github.com/manual/gh_secret_set)

---

## Step-by-Step Setup

### Step 1: Create Master Token on Coolify

1. Open your Coolify dashboard (`<COOLIFY_PANEL_URL>`).
2. Navigate to **Keys & Tokens** (or **Settings → API Tokens**).
3. Click **Create New Token**:
   - **Name**: `Global-Agent-CI-Token`
   - **Expiration**: None / Maximum allowable duration
   - **Permissions**: Full API / Deploy scope
4. Copy the generated token string (e.g. `9|cool_1234567890abcdef...`).

> [!NOTE]
> The token string contains both the token ID prefix and the hash (format: `<id>|<hash>`). Both parts are required for HTTP Authorization headers (`Authorization: Bearer <id>|<hash>`).

---

### Step 2: Store Token in Local Agent Config

Create the global configuration file on your machine or agent environment:

```bash
mkdir -p ~/.config/coolify
cat << 'EOF' > ~/.config/coolify/credentials.env
COOLIFY_BASE_URL="<COOLIFY_PANEL_URL>"
COOLIFY_API_TOKEN="<ID>|<HASH>"
EOF
chmod 600 ~/.config/coolify/credentials.env
```

Add auto-sourcing to your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
if [ -f "$HOME/.config/coolify/credentials.env" ]; then
    set -a
    source "$HOME/.config/coolify/credentials.env"
    set +a
fi
```

Now, any tool, shell session, or coding agent will automatically have `COOLIFY_BASE_URL` and `COOLIFY_API_TOKEN` in its environment.

---

### Step 3: Sync Secrets to GitHub Repositories

Using the authenticated `gh` CLI, push the secrets across your repositories with a single script:

```bash
#!/usr/bin/env bash
set -euo pipefail

source "$HOME/.config/coolify/credentials.env"

# List your target repositories
REPOS=(
  "OWNER/PROJECT-1"
  "OWNER/PROJECT-2"
  "OWNER/PROJECT-3"
)

for repo in "${REPOS[@]}"; do
  echo "==> Syncing Coolify secrets to ${repo}..."
  gh secret set COOLIFY_API_TOKEN --repo "${repo}" --body "${COOLIFY_API_TOKEN}"
  gh secret set COOLIFY_BASE_URL  --repo "${repo}" --body "${COOLIFY_BASE_URL}"
done

echo "✅ All repositories updated successfully."
```

*(If using a GitHub Organization, you can alternatively set `COOLIFY_API_TOKEN` and `COOLIFY_BASE_URL` once as Organization Secrets with repository access set to "All repositories".)*

---

## Verification

Test the token with a read-only call to the Coolify API:

```bash
curl -sk -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  "${COOLIFY_BASE_URL}/api/v1/applications" | jq .
```
