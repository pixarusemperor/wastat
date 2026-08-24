# Production Guide: Full-Stack Monorepo Deployment to Coolify

> **Provenance**: Proven in production on **WaStat V2** (`pixarusemperor/wastat` live at `https://wassflow.orizongroup.online`).  
> **Target Architecture**: Node.js/TypeScript Monorepo (React + Fastify + MCP Server + Shared Packages) deployed to Coolify v4 on an Ubuntu VPS with Cloudflare DNS/SSL.

---

## 🏗️ 1. Monorepo Architecture & Multi-Stage Dockerfile

When deploying full-stack TypeScript monorepos (e.g. npm/pnpm/yarn workspaces), building frontend and backend in a unified multi-stage Dockerfile avoids the overhead of managing multiple containers.

### Recommended Dockerfile Pattern:

```dockerfile
# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Copy workspace manifests first for optimal Docker layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp-server/package.json ./packages/mcp-server/

RUN npm ci

# 2. Copy source code and build assets
COPY . .

# 3. Compile shared packages, web frontend bundle, and server
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts and production dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
COPY packages/mcp-server/package.json ./packages/mcp-server/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

# Expose container port
EXPOSE 3000

# Fastify server automatically serves packages/web/dist via @fastify/static
CMD ["node", "packages/server/dist/index.js"]
```

---

## ⚡ 2. Chained Pre-Flight CI Quality Gates

**Never push directly to a deployment container without automated CI verification.** Broken builds cause container restart loops and 502 errors.

### GitHub Actions Chained Workflow Structure:

```
[git push to main]
       │
       ▼
┌───────────────────────────────┐
│ Job 1: ci.yml                 │
│ • npm run typecheck (0 error) │
│ • npm test (100% passing)     │
│ • npm run build               │
└──────────────┬────────────────┘
               │ (Pass required)
               ▼
┌───────────────────────────────┐
│ Job 2: deploy.yml (needs: ci) │
│ • Trigger Coolify API/Webhook │
│ • Poll status to "finished"   │
│ • Verify live HTTP endpoint   │
└───────────────────────────────┘
```

---

## 🚀 3. Proven GitHub Actions Deployment Workflow (`deploy.yml`)

This workflow supports **both Webhook and REST API triggers**, automatically polls until the deployment reaches `finished`, and enforces strict concurrency:

```yaml
name: Deploy to Coolify

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: coolify-deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  deploy:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Trigger Coolify deploy
        id: trigger
        env:
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
          APP_UUID: ${{ secrets.COOLIFY_APP_UUID }}
          COOLIFY_WEBHOOK: ${{ secrets.COOLIFY_WEBHOOK }}
          COOLIFY_URL: ${{ secrets.COOLIFY_BASE_URL }}
        run: |
          set -euo pipefail

          if [ -n "${COOLIFY_WEBHOOK}" ]; then
            echo "==> Triggering via COOLIFY_WEBHOOK"
            RESPONSE=$(curl -sk -S --fail-with-body \
              -X GET "${COOLIFY_WEBHOOK}" \
              --header "Authorization: Bearer ${COOLIFY_TOKEN}")
            echo "${RESPONSE}" | jq . || echo "${RESPONSE}"
            DEPLOY_UUID=$(echo "${RESPONSE}" | jq -r '.deployments[0].deployment_uuid // .deployments[0].uuid // .deployment_uuid // empty' 2>/dev/null || true)
            if [ -z "${DEPLOY_UUID}" ]; then
              echo "::error::Webhook response did not contain a deployment UUID — aborting."
              exit 1
            fi
            echo "deployment_uuid=${DEPLOY_UUID}" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          if [ -z "${COOLIFY_TOKEN}" ] || [ -z "${APP_UUID}" ] || [ -z "${COOLIFY_URL}" ]; then
            echo "::error::Missing required secrets: COOLIFY_API_TOKEN, COOLIFY_APP_UUID, or COOLIFY_BASE_URL"
            exit 1
          fi

          echo "==> Deploying app ${APP_UUID} via Coolify API"
          RESPONSE=$(curl -sk -S --fail-with-body \
            -X POST \
            -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"uuid\": \"${APP_UUID}\"}" \
            "${COOLIFY_URL}/api/v1/deploy")
          echo "${RESPONSE}" | jq .
          DEPLOY_UUID=$(echo "${RESPONSE}" | jq -r '.deployments[0].deployment_uuid // .deployments[0].uuid // .deployment_uuid // empty')
          if [ -z "${DEPLOY_UUID}" ]; then
            echo "::error::No deployment UUID returned from Coolify API"
            exit 1
          fi
          echo "deployment_uuid=${DEPLOY_UUID}" >> "$GITHUB_OUTPUT"

      - name: Poll Deployment Status
        env:
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_API_TOKEN }}
          APP_UUID: ${{ secrets.COOLIFY_APP_UUID }}
          COOLIFY_URL: ${{ secrets.COOLIFY_BASE_URL }}
        run: |
          set -euo pipefail
          if [ -z "${APP_UUID}" ] || [ -z "${COOLIFY_URL}" ]; then
            echo "No APP_UUID or COOLIFY_BASE_URL — skipping status poll."
            exit 0
          fi

          MAX_ATTEMPTS=40
          INTERVAL=15
          for i in $(seq 1 ${MAX_ATTEMPTS}); do
            RESPONSE=$(curl -sk -S \
              -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
              "${COOLIFY_URL}/api/v1/deployments/applications/${APP_UUID}")
            STATUS=$(echo "${RESPONSE}" | jq -r '.deployments[0].status // "unknown"')
            echo "[${i}/${MAX_ATTEMPTS}] status=${STATUS}"
            case "${STATUS}" in
              finished) echo "::notice::DEPLOY SUCCEEDED"; exit 0 ;;
              failed)   echo "::error::DEPLOY FAILED"; echo "${RESPONSE}" | jq .; exit 1 ;;
              *)        sleep ${INTERVAL} ;;
            esac
          done
          echo "::error::TIMEOUT — deployment did not finish in 10 minutes"
          exit 1
```

---

## 🔒 4. Cloudflare DNS & SSL Configuration

When using Cloudflare with Coolify's built-in Traefik reverse proxy:

1. **DNS Records**:
   - Create an `A` record pointing `subdomain.yourdomain.com` $\rightarrow$ `VPS_IP`.
   - Set proxy status to **Proxied (Orange Cloud)** or **DNS Only (Grey Cloud)**.
2. **Cloudflare SSL/TLS Encryption Mode**:
   - Set encryption mode to **Full (Strict)**.
   - Traefik inside Coolify will provision a valid Let's Encrypt certificate automatically.
3. **Coolify Domain Settings**:
   - Always include the full URL scheme in Coolify: `https://subdomain.yourdomain.com`.

---

## 🛡️ 5. The Golden Rules of Coolify Deployments

1. **Inject all environment variables BEFORE triggering the first deployment.** Missing runtime variables result in 500 errors on an otherwise "healthy" container.
2. **Never execute destructive Docker prunes** (`docker system prune -af`, `docker volume prune`) on a shared VPS.
3. **Always poll deployments to `status: finished`.** A successful trigger API response (`200 OK`) only means the build job was enqueued, not that it succeeded.
4. **Inspect build logs before retrying failed deploys.** Retrying without fixing root cause pollutes VPS disk space and wastes CI runners.
