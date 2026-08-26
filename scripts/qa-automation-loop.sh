#!/usr/bin/env bash
# Tight red-capable loop for "automation not working after Supabase migration":
# boot in Supabase mode, replay real Wasender webhook payloads, and observe
# whether sessions resolve, executions get created, and where they land.
set -u
cd "$(dirname "$0")/.."

PORT=4599
BASE="http://127.0.0.1:${PORT}"

# Load only the vars we need, robust to the pasted-markdown noise in .env
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
WASENDER_PAT=$(grep -E '^WASENDER_PAT=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "=== booting in Supabase mode (port $PORT) ==="
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
(
  cd packages/server
  unset DBURL
  env -u DATABASE_URL PORT=$PORT MOCK_SEND=1 \
    SUPABASE_URL="$SUPABASE_URL" DATABASE_URL="$DATABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" WASENDER_PAT="$WASENDER_PAT" \
    setsid npx tsx src/index.ts >/tmp/qa-automation-server.log 2>&1 &
)
# wait for /health
for i in $(seq 1 40); do
  code=$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "$BASE/health" 2>/dev/null || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done
echo "health: $code"

echo
echo "=== boot log (provider + sync lines) ==="
grep -E "provider|Synced|Could not auto|error|ENETUNREACH|AutoSeed" /tmp/qa-automation-server.log | head -20

echo
echo "=== 1. POST /webhooks/wasender/112691 (Patrick Simo, real session in Supabase) ==="
curl -sS -m 10 -X POST "$BASE/webhooks/wasender/112691" \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.received","timestamp":1787659205,"data":{"messages":{"key":{"id":"PATRICK_MSG_QA2","remoteJid":"15550199833@s.whatsapp.net","cleanedSenderPn":"+15550199833"},"pushName":"Safari Host","messageBody":"Welcome to your luxury experience"}}}'
echo

echo
echo "=== 2. POST /webhooks/wasender/105947 (Safari, seeded) with matching keyword 'hello' ==="
curl -sS -m 10 -X POST "$BASE/webhooks/wasender/105947" \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.received","timestamp":1787659200,"data":{"messages":{"key":{"id":"SAFARI_MSG_QA2","remoteJid":"15550199832@s.whatsapp.net","cleanedSenderPn":"+15550199832"},"pushName":"Patrick Simo","messageBody":"hello safari"}}}'
echo

echo
echo "=== 3. GET /api/executions (what the app UI reads) ==="
curl -sS -m 10 "$BASE/api/executions?limit=10"
echo

echo
echo "=== 4. Supabase REST: executions count (what Postgres actually holds) ==="
curl -sS -m 10 "$SUPABASE_URL/rest/v1/workflow_executions?select=id,workflow_id,status,current_node_key&order=id.desc&limit=5" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
echo
echo "=== 5. Supabase REST: messages (inbound + outbound) ==="
curl -sS -m 10 "$SUPABASE_URL/rest/v1/messages?select=id,direction,message_type,text,workflow_execution_id&order=id.desc&limit=8" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
echo
echo "=== 6. Supabase REST: jobs (scheduler queue) ==="
curl -sS -m 10 "$SUPABASE_URL/rest/v1/jobs?select=id,type,execution_id,status,payload&order=id.desc&limit=5" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
echo
echo "=== 7. Supabase REST: sessions ==="
curl -sS -m 10 "$SUPABASE_URL/rest/v1/sessions?select=id,name,provider_session_id,status" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
echo

echo
echo "=== 8. Test-lab: every media type sends (virtual, in-memory, same engine) ==="
curl -sS -m 120 -X POST "$BASE/api/test-lab/run-all" \
  -H "Content-Type: application/json" -d '{}' > /tmp/qa-testlab.json
python3 - <<'PY'
import json
raw = open("/tmp/qa-testlab.json").read()
try:
    d = json.loads(raw)
except Exception as e:
    print("non-JSON response (server may have crashed):", raw[:300])
    raise SystemExit(1)
print("total=%s passed=%s failed=%s" % (d.get("total"), d.get("passed"), d.get("failed")))
for r in d.get("results", []):
    m = r.get("metrics") or {}
    print("  %s: %s  %s" % (r.get("scenarioId"), r.get("status"), json.dumps(m)[:120]))
if d.get("failed", 0) > 0:
    for r in d.get("results", []):
        if r.get("status") == "failed":
            print("  FAIL", r.get("scenarioId"), "-", r.get("error") or r.get("logs"))
PY
echo

# cleanup
pkill -f "tsx src/index.ts" 2>/dev/null || true
echo "=== done ==="
