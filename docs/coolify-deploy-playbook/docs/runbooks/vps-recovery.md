# Runbook — Coolify VPS Recovery

> **When to use**: Coolify panel (`https://coolifyone.orizongroup.online`) unreachable,
> app domains returning 500/000, or deployments failing with disk errors.
> **Proven**: 2026-08-21 — full outage recovered with zero data loss using exactly
> these steps. Written from the live incident; every command below was executed.

---

## TL;DR decision tree

```
Panel/domain down?
├─ Can you SSH to the VPS? (stevenjossu@34.155.88.118)
│   ├─ YES → go to §2 (diagnose in order: disk → coolify-db → panel)
│   └─ NO  → go to §1 (emergency access via GCP metadata)
└─ Only the APP is down (panel fine)? → jump to §5 (app-level diagnosis)
```

---

## 1. Emergency VPS access (no SSH key on your machine)

This VPS is the GCE instance `the-brain-server` (zone `europe-west9-a`, project
`project-55ca538e-3b9e-42dc-9ca`, external IP `34.155.88.118`). If instance
metadata API access is available (gcloud ADC credentials on the local machine),
you can install your own SSH key **without touching anything else**:

```bash
# 1. Get a token
gcloud auth application-default print-access-token > /tmp/tok.txt
TOKEN=$(cat /tmp/tok.txt | tr -d '\n')

# 2. Generate a key — MUST be RSA. The guest agent rejects ed25519
#    ("invalid ssh key entry - unrecognized format" in serial console).
ssh-keygen -t rsa -b 4096 -f ~/.ssh/vps_recovery_rsa -N "" -C recovery

# 3. Read FULL instance metadata (a ?fields= read returns a STALE fingerprint
#    → HTTP 412 on write; always re-read the whole resource first)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://compute.googleapis.com/compute/v1/projects/project-55ca538e-3b9e-42dc-9ca/zones/europe-west9-a/instances/the-brain-server" \
  > meta-full.json

# 4. Append your key to ssh-keys (preserve ALL existing entries), POST setMetadata
python3 << 'EOF'
import json
d = json.load(open("meta-full.json"))
md = d["metadata"]; items = md["items"]
ssh = next((i for i in items if i["key"] == "ssh-keys"), None)
lines = [l for l in (ssh["value"].splitlines() if ssh else []) if l.strip()]
lines.append("stevenjossu:" + open("/home/YOU/.ssh/vps_recovery_rsa.pub").read().strip())
payload = {"fingerprint": md["fingerprint"],
           "items": [{"key": i["key"], "value": i["value"]} for i in items if i["key"] != "ssh-keys"]
                    + [{"key": "ssh-keys", "value": "\n".join(lines)}]}
json.dump(payload, open("payload.json", "w"))
EOF
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d @payload.json \
  "https://compute.googleapis.com/compute/v1/projects/project-55ca538e-3b9e-42dc-9ca/zones/europe-west9-a/instances/the-brain-server/setMetadata"

# 5. Wait ~30s for google-guest-agent to provision, then:
ssh -i ~/.ssh/vps_recovery_rsa stevenjossu@34.155.88.118
```

**Read-only diagnostics without SSH** (work even when locked out):
- Serial console: `GET .../instances/the-brain-server/serialPort?port=1` — shows
  kernel logs, guest-agent errors, OOM kills. This is how we saw the ed25519 rejection.
- Instance status/IPs: `GET .../aggregated/instances`.

**Cleanup after recovery**: remove the temporary key from metadata the same way
(delete your line, keep everything else). Browser-SSH keys in metadata expire on
their own (they carry `"expireOn"` fields).

---

## 2. Diagnose in THIS order (each step can be the whole problem)

### 2a. Disk first — it is almost always disk

```bash
df -h /
```

| Free space | Meaning |
|---|---|
| < 2GB | Builds WILL fail (`ENOSPC`); Postgres may have PANICed; fix before anything else |
| < 500MB | System in danger; free space immediately (§3) |

Why first: one Docker build of this project needs **~2–3GB transient**. A failed
build leaves layer cache that outlives the build. The 2026-08-21 outage chain was:

```
env-var change triggered full rebuild
→ ENOSPC mid pnpm install (build fails)
→ coolify-db (Postgres) hits ENOSPC during WAL checkpoint
→ Postgres PANIC: "could not write to file pg_logical/replorigin_checkpoint.tmp"
→ Postgres shuts down; panel hangs waiting on DB (HTTP timeout forever)
→ containers show "healthy", panel shows dead
```

Note: **the panel never crashed**. It waited on a database that was gone.
`docker ps` showed everything healthy except `coolify` (unhealthy). Disk is the
root cause hiding behind three different symptoms.

### 2b. Check the Coolify containers honestly

```bash
docker ps --filter name=coolify --format "{{.Names}}: {{.Status}}"
docker logs coolify --tail 20        # look for SQLSTATE[08006] "could not translate host name coolify-db"
docker inspect coolify-db --format "{{.State.Status}} | {{.State.Health.Status}}"
docker logs coolify-db | tail -30    # look for PANIC / "No space left on device"
```

`SQLSTATE[08006] could not translate host name "coolify-db"` = the DB container
is detached/dead while still listed on the network. Confirm with:

```bash
docker exec coolify getent hosts coolify-db   # fails when DB is down/detached
docker inspect coolify-db --format '{{json .NetworkSettings.Networks}}'  # IPAddress empty = detached
```

### 2c. Panel alive locally?

```bash
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' http://localhost:8000/
```

- `200/302` fast → panel fine, problem is Traefik/DNS (check `coolify-proxy`)
- Timeout → panel itself is stuck (usually waiting on the DB → back to 2b)

---

## 3. Free disk space — SAFE ORDER (do not skip to the bottom)

Run top-to-bottom, stopping when you have ≥3GB free:

```bash
# 1. Caches (100% safe, regenerate automatically)
sudo apt-get clean
rm -rf ~/.npm/_cacache ~/.npm/_npx ~/.cache/pip ~/.cache/uv ~/.cache/node
sudo journalctl --vacuum-size=50M
sudo rm -rf /var/lib/snapd/cache/*          # snap download cache, regenerates
sudo docker builder prune -f --filter "until=24h"   # stale build cache only

# 2. Agent scratchpads on the VPS (session temp data)
rm -rf /tmp/commandcode-* /tmp/node-compile-cache

# 3. Desktop snaps on a headless server (~1.4GB — confirmed useless here;
#    ask the owner first if unsure. Proven removable 2026-08-21):
sudo snap remove --purge gnome-46-2404 mesa-2404 cups chromium gtk-common-themes bare

# 4. Dangling docker images (unreferenced layers from FAILED builds)
sudo docker image prune -f
```

**NEVER on this box** (destroys running apps / databases):
- `docker system prune -af` — removes stopped app images (wassflow rollback!)
- `docker volume prune` — volumes hold `coolify-db` data = all app config history
- `snap remove` core22/core24/snapd/google-cloud-cli/gh — system deps in use
- Deleting `/data/coolify/**`, anything under `/var/lib/docker`, `/var/lib/containerd`
- User projects in `/home/stevenjossu/*` without asking

## 4. Restart what died

After disk is healthy (>3GB free):

```bash
docker start coolify-db        # Postgres replays WAL and recovers by itself
sleep 10
docker logs coolify-db | tail -5     # want: "database system is ready to accept connections"
docker restart coolify               # panel reconnects
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/   # expect 200/302
```

Then verify externally: `curl -sk https://coolifyone.orizongroup.online/api/health`.
Full recovery took <2 minutes once disk was clear. **No rebuild needed** — images
and volumes survive the whole incident.

---

## 5. App-level diagnosis (panel fine, app broken)

```bash
APP_UUID=<from cookbook §8>
TOKEN=$(grep ^COOLIFY_API_TOKEN ~/PROJECT/.env.local | cut -d= -f2-)

# Where is it stuck?
curl -sk -H "Authorization: Bearer $TOKEN" \
  "https://coolifyone.orizongroup.online/api/v1/deployments/applications/$APP_UUID"

# Build logs (visible entries hide the real error; pull raw JSON):
ssh stevenjossu@34.155.88.118
sudo docker exec coolify-db psql -U coolify -d coolify -t -A -c \
  "SELECT logs FROM application_deployment_queues WHERE deployment_uuid='<UUID>';" \
  > /tmp/deplog.json
python3 -c "
import json
for e in json.loads(open('/tmp/deplog.json').read().strip()):
    o = str(e.get('output',''))
    if 'ERROR' in o.upper() or 'error' in o.lower(): print(o[:300])
"
```

Two distinct app-down modes seen in production:

| Symptom | Cause | Fix |
|---|---|---|
| Container `healthy`, every request 500 | Zod env validation throws on first request (see `lib/env.ts` failure-mode comments; TCP healthcheck can't see it) | set the missing vars OR make them optional; redeploy |
| Domain 404/timeout, container fine | Traefik label lag (30–60s) or stale static route | wait, then check `coolify-proxy` dynamic config |

Get the actual 500 body: `curl -sk https://DOMAIN | head -c 2000`, and container
logs: `docker logs <container-name> --tail 50`.

---

## 6. After any recovery — checklist

- [ ] `df -h /` shows ≥3GB free (build headroom), note it in the incident log
- [ ] All 12 containers `Up ... (healthy)` including `coolify` and `coolify-db`
- [ ] Panel loads: `https://coolifyone.orizongroup.online`
- [ ] API answers: authenticated GET `/api/v1/applications`
- [ ] Apps respond: wassflow, superads domains return expected codes
- [ ] Temporary SSH keys removed from GCP metadata (if §1 was used)
- [ ] Root cause written into `docs/DIAGNOSTIC-AND-FIX.md` (append, never delete)
