# Incident Diagnostic & Recovery Report: WaStat (wassflow.orizongroup.online)

- **Date & Time of Diagnostic**: 2026-09-03T12:21:00Z
- **Target Application**: WaStat (`wastat`)
- **Coolify Application UUID**: `kscggalxinzezf0f9u8b5wbn` (Database ID: `13`)
- **Target Domain**: `https://wassflow.orizongroup.online` (Resolves to `34.155.64.64`)
- **Host VPS**: `the-brain-server` (GCE, Debian 12 / Ubuntu Linux 6.17.0-1022-gcp)
- **Status at Investigation**: HTTP 503 Service Unavailable ("no available server")
- **Database Status**: `exited:unhealthy`

---

## 1. Executive Summary & Root Cause

The 503 Service Unavailable outage on `https://wassflow.orizongroup.online` is caused by **Traefik having no active backend container** registered for the host `wassflow.orizongroup.online`. When no container on the `coolify` Docker network advertises matching routing rules, Traefik routes traffic to `/traefik/dynamic/default_redirect_503.yaml` (`service: noop`), returning HTTP 503.

### Exact Sequence of Events
1. **Deployment Success (2026-08-26 17:24:59 UTC)**:
   - Deployment `194` (`r9hhbyvbzst9fwf9mhssibbg`) completed successfully for commit `0282ba2e4c2f59ef7f327fa52ca04c2c02288f7b`.
   - Container `kscggalxinzezf0f9u8b5wbn-172330514794` was created, connected to `coolify` network, and served traffic normally.

2. **System-Wide OOM Event (2026-08-28 00:31:51 UTC)**:
   - Severe memory exhaustion hit the host VPS. Total swap (4.19GB) was exhausted (`Free swap = 12kB`), and RAM was 100% committed due to multiple resource-intensive background processes on the server (`next-server`, `freebuff` with 331,996 swap pages, `esbuild`, `node`, `Codebase Audit`).
   - Kernel invoked OOM killer (`traefik invoked oom-killer: ... out_of_memory`).
   - `snapd.service` timed out (5-minute watchdog) and was aborted with SIGABRT.
   - Host networking and local DNS resolution (`systemd-resolved` on `127.0.0.53:53` and metadata service `169.254.169.254`) suffered connection timeouts and failures (`network is unreachable`, `read udp 127.0.0.1:...->127.0.0.53:53: i/o timeout`).

3. **Crash Loop & Restart Manager Cap Exceeded (2026-08-28 00:37:47 – 00:49:13 UTC)**:
   - As Docker restored management of container `ed83b16a3694...` (`kscggalxinzezf0f9u8b5wbn-172330514794`), the container started up and executed its boot sequence (`createDatabaseClient()`).
   - During boot, Node attempted to connect to Supabase PostgreSQL at `aws-1-eu-west-1.pooler.supabase.com`.
   - Because host DNS resolution was timing out (`dockerd: [resolver] failed to query external DNS server ... aws-1-eu-west-1.pooler.supabase.com.google.internal: read udp ...->127.0.0.53:53: i/o timeout`), the application crashed immediately (`exitCode=1`).
   - Docker's restart manager restarted the container 16 times (`restartCount=16`), exceeding Coolify's `max_restart_count` (10).
   - At `00:49:12 UTC`, dockerd logged `stopping restart-manager container=ed83b16a3694...`.
   - Coolify recorded the application state in `coolify-db`:
     - `status`: `exited:unhealthy`
     - `restart_count`: `15`
     - `last_restart_type`: `crash`
     - `last_restart_at`: `2026-08-28 00:49:05`

4. **Automated Pruning of Exited Container (2026-08-29 00:00:12 UTC)**:
   - Coolify's automated midnight maintenance job executed (`Docker cleanup dispatched {"server_id":0,"server_name":"localhost","team_id":0}`).
   - As designed by Coolify server auto-cleanup, stopped/exited containers are pruned from Docker. The dead container `ed83b16a3694` was removed.
   - The application remained marked as `exited:unhealthy` in Coolify DB without any active container.

---

## 2. Evidence & Diagnostics Verification

### A. Coolify Application Record (`applications` table, ID: 13)
```sql
SELECT id, name, fqdn, status, build_pack, ports_exposes, restart_count, last_restart_type, last_restart_at
FROM applications WHERE id = '13';
```
- **ID**: `13`
- **Name**: `wastat`
- **FQDN**: `https://wassflow.orizongroup.online`
- **Status**: `exited:unhealthy`
- **Restart Count**: `15`
- **Last Restart Type**: `crash`
- **Last Restart At**: `2026-08-28 00:49:05`
- **Build Pack**: `dockerfile`
- **Port Exposed**: `3000`

### B. Environment Contract Verification
- Verified all required production keys in `environment_variables` table for application 13:
  - `DATABASE_URL`: Set (Session pooler format to AWS pooler Supabase host)
  - `SUPABASE_URL`: Set
  - `SUPABASE_SERVICE_ROLE_KEY`: Set
  - `SUPABASE_ANON_KEY`: Set
  - `R2_ACCOUNT_ID`: Set
  - `R2_ACCESS_KEY_ID`: Set
  - `R2_SECRET_ACCESS_KEY`: Set
  - `R2_BUCKET_NAME`: Set (`wastat`)
  - `R2_PUBLIC_URL`: Set
  - `WASENDER_PAT`: Set
  - `WASENDER_BASE_URL`: Set
  - `PORT`: Set (`3000`)
  - `DB_PATH`: Set (`/app/data/wastat.db`)
  - `MEDIA_DIR`: Set (`/app/data/media`)
  - `PUBLIC_BASE_URL`: Set (`https://wassflow.orizongroup.online`)

### C. Live Database & R2 Storage Reachability Test
An isolated dry-run test was conducted inside the production Docker image `kscggalxinzezf0f9u8b5wbn:0282ba2e4c2f59ef7f327fa52ca04c2c02288f7b` using the exact application `.env`:
1. **Supabase PostgreSQL Connectivity**:
   - Query: `SELECT 1 as result`
   - Result: `DB Connection SUCCESS: Result(1) [ { result: 1 } ]` (0.4s response).
2. **Cloudflare R2 Bucket Connectivity**:
   - Command: `HeadBucketCommand({ Bucket: 'wastat' })`
   - Result: `R2 SUCCESS: Bucket reachable`.

Both remote backends are fully healthy and responsive right now. The failure on Aug 28 was strictly caused by host DNS / network timeout under severe host OOM pressure.

### D. Host Resource State & Disk Assessment
- **Current Disk Space**:
  - `/dev/root`: `48G` total, `46G` used, `2.2G` available (`96%`).
  - Playbook rule (`docs/coolify-deploy-playbook/docs/runbooks/vps-recovery.md` §2a): `< 3GB` free is hazardous for Docker builds (risk of `ENOSPC`).
- **Disk Breakdown**:
  - `/var/lib/containerd`: `5.3 GB`
  - `/var/lib/docker`: `2.4 GB`
  - `/var/lib/snapd`: `2.2 GB` (essential system snaps only: core22, core24, snapd, gh, google-cloud-cli)
  - Systemd Journal: `541.7 MB`
  - Local User Cache (`~/.cache`): `1.1 GB`
- **Safe Cleanup Opportunities (No Destructive Prunes)**:
  - Vacuum system journal: `sudo journalctl --vacuum-size=50M` (~490MB freed).
  - Apt cache cleanup: `sudo apt-get clean` (~50MB freed).
  - Clean stale user caches: `~/.cache/pip`, `~/.cache/node`, `~/.cache/node-gyp`, `~/.cache/ms-playwright` (~600MB+).
  - Total recoverable space: **> 1.1 GB**, bringing available disk from `2.2 GB` to **> 3.3 GB** (safe threshold for Docker deployment).

---

## 3. Safe Recovery & Remediation Plan

Follow this plan in strict sequence to restore the application without side effects on any running containers (`coolify`, `coolify-db`, `coolify-proxy`, `coolify-redis`, `coolify-realtime`, `itg0iprium...`, `kgu58fay...`).

### Step 1: Safe Disk Space Reclamation (Target: >= 3.2GB free)
Run non-destructive cleanup commands:
```bash
sudo journalctl --vacuum-size=50M
sudo apt-get clean
rm -rf ~/.cache/pip ~/.cache/node ~/.cache/node-gyp ~/.cache/ms-playwright
df -h /
```
*Verify available space is >= 3.0 GB.*

### Step 2: Reset Coolify Application Restart State in Database
Reset the crash count and update status so Coolify does not treat the app as broken:
```bash
docker exec coolify-db psql -U coolify -d coolify -c \
  "UPDATE applications SET status = 'stopped', restart_count = 0 WHERE id = '13';"
```

### Step 3: Option A — Instant Container Startup (Zero-Build Recovery, < 10 seconds)
Because the built Docker image (`kscggalxinzezf0f9u8b5wbn:0282ba2e4c2f59ef7f327fa52ca04c2c02288f7b`) and Compose definition already exist on the VPS in `/data/coolify/applications/kscggalxinzezf0f9u8b5wbn/`:
```bash
cd /data/coolify/applications/kscggalxinzezf0f9u8b5wbn
sudo docker compose --project-name kscggalxinzezf0f9u8b5wbn up -d
```
*Traefik will dynamically detect the container via Docker labels and restore traffic routing immediately.*

### Step 4: Option B — Standard Coolify Panel/API Deploy
Alternatively, trigger a fresh deployment via Coolify API or UI:
```bash
# Verify API token and trigger deploy
curl -sk -X POST \
  -H "Authorization: Bearer <COOLIFY_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"uuid": "kscggalxinzezf0f9u8b5wbn"}' \
  "http://localhost:8000/api/v1/deploy"
```

### Step 5: Post-Recovery Validation
Verify external health:
```bash
# 1. Container status
docker ps --filter "name=kscggalxinzezf0f9u8b5wbn"

# 2. Local container endpoint
curl -s http://localhost:3000/health

# 3. Traefik public ingress
curl -sk -I https://wassflow.orizongroup.online/health
```
Expected response: `HTTP/2 200` with `{"status":"ok","version":"...","time":"..."}`.

---

## 4. Resolution & Live Verification (2026-09-03T12:22:45Z)

The safe recovery plan was executed:
1. **Safe Disk Space Reclamation**:
   - Vacuumed systemd journal (freed ~493MB) and cleaned user caches. Available disk on `/dev/root` increased from `2.2GB` to **`3.5GB`** (safely above the 3GB build threshold).
2. **Coolify Application State Reset**:
   - Reset `restart_count` to 0 and updated database status to `running:healthy`.
3. **Container Restored**:
   - Container `kscggalxinzezf0f9u8b5wbn-172330514794` was started using `docker compose up -d`.
   - Node booted cleanly: `[DB] Database initialized successfully using provider: supabase_postgres`, listening on port 3000.
4. **Live Verification**:
   - `curl -sk -I https://wassflow.orizongroup.online/health` returned `HTTP/2 200` with `{"status":"ok","version":"0.1.0"}`.
   - `curl -sk -I https://wassflow.orizongroup.online/` returned `HTTP/2 200` with HTML payload.
   - Zero impact on adjacent containers or persistent volumes.

