#!/usr/bin/env bash
# Tight red-capable QA loop for A/B Option C on Supabase:
# boot in Supabase mode, create an experiment with a shared trigger, add
# trigger-less presentation variants, fire real-shaped webhooks, and verify
# assignment, execution, weighted distribution, and adopt-winner.
set -u
cd "$(dirname "$0")/.."

PORT=4599
BASE="http://127.0.0.1:${PORT}"

SUPABASE_URL=$(grep -E '^SUPABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
WASENDER_PAT=$(grep -E '^WASENDER_PAT=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "=== booting in Supabase mode (port $PORT) ==="
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 1
(
  cd packages/server
  env -u DATABASE_URL PORT=$PORT MOCK_SEND=1 \
    SUPABASE_URL="$SUPABASE_URL" DATABASE_URL="$DATABASE_URL" \
    SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" WASENDER_PAT="$WASENDER_PAT" \
    setsid npx tsx src/index.ts >/tmp/qa-ab-server.log 2>&1 &
)
for i in $(seq 1 45); do
  code=$(curl -sS -m 2 -o /dev/null -w "%{http_code}" "$BASE/health" 2>/dev/null || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done
echo "health: $code"
grep -E "provider|Synced|Backfilled" /tmp/qa-ab-server.log | head -6

echo
echo "=== 1. create experiment with shared trigger (weighted) ==="
EXP=$(curl -sS -m 10 -X POST "$BASE/api/experiments" \
  -H "Content-Type: application/json" \
  -d '{"name":"QA A/B Weighted","description":"slice9","triggerKeywords":["prix","price","offer"],"triggerAlgorithm":"exact","triggerThreshold":100,"distributionMode":"weighted"}')
echo "$EXP"
EXP_ID=$(echo "$EXP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

echo
echo "=== 2. add two trigger-less presentation variants ==="
VA=$(curl -sS -m 10 -X POST "$BASE/api/experiments/$EXP_ID/variants" \
  -H "Content-Type: application/json" -d '{"name":"Variant A","weight":25}')
echo "$VA"
VB=$(curl -sS -m 10 -X POST "$BASE/api/experiments/$EXP_ID/variants" \
  -H "Content-Type: application/json" -d '{"name":"Variant B","weight":75}')
echo "$VB"
VA_ID=$(echo "$VA" | python3 -c "import sys,json;print(json.load(sys.stdin)['workflowId'])")
VB_ID=$(echo "$VB" | python3 -c "import sys,json;print(json.load(sys.stdin)['workflowId'])")

echo
echo "=== 3. give variant B a real presentation graph (send_text -> end, NO trigger) ==="
curl -sS -m 10 -X PUT "$BASE/api/workflows/$VB_ID" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Variant B\",\"description\":null,\"active\":1,\"experimentId\":$EXP_ID,\"nodes\":[{\"nodeKey\":\"s\",\"type\":\"send_text\",\"config\":{\"text\":\"presentation-B\"},\"positionX\":0,\"positionY\":0},{\"nodeKey\":\"e\",\"type\":\"end\",\"config\":{},\"positionX\":200,\"positionY\":0}],\"edges\":[{\"sourceKey\":\"s\",\"targetKey\":\"e\"}]}" >/dev/null && echo "graph saved on variant $VB_ID"

echo
echo "=== 4. verify variants have NO trigger node (Option C) ==="
TRIG_A=$(curl -sS -m 10 "$BASE/api/workflows/$VA_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)
trig=[n for n in d.get('nodes',[]) if n.get('type')=='trigger']
print('trigger nodes:', len(trig), '| nodes:', len(d.get('nodes',[])))")
echo "$TRIG_A"

echo
echo "=== 4. fire webhook with matching keyword -> experiment routes ==="
# pick the Safari session (105947) that exists in prod Supabase
SESSION=$(curl -sS -m 10 "$BASE/api/sessions" | python3 -c "
import sys,json
ss=json.load(sys.stdin)
print(ss[0]['providerSessionId'] if ss else 'none')")
echo "session: $SESSION"
TS=$(date +%s)
# The handler reads body.data.messages.key (single object), not an array.
WEB=$(curl -sS -m 10 -X POST "$BASE/webhooks/wasender/$SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"messages.upsert\",\"timestamp\":$TS,\"data\":{\"messages\":{\"key\":{\"id\":\"QAAB_$TS\",\"remoteJid\":\"23769991234@s.whatsapp.net\",\"fromMe\":false},\"messageBody\":\"I want the price please\",\"pushName\":\"QA\"}}}")
echo "$WEB"

sleep 3

echo
echo "=== 5. verify assignment + execution in Supabase ==="
SERVICE_KEY="$SERVICE_KEY" python3 - <<'PY'
import json, os, urllib.request
base = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SERVICE_KEY"]
def get(path):
    req = urllib.request.Request(base + path, headers={"apikey": key, "Authorization": "Bearer " + key})
    return json.load(urllib.request.urlopen(req))
exps = get("/rest/v1/experiments?select=id,name,active,trigger_keywords,distribution_mode&order=id.desc&limit=3")
print("experiments:", json.dumps(exps, indent=1)[:600])
assigns = get("/rest/v1/experiment_assignments?select=experiment_id,workflow_id,contact_id&limit=5")
print("assignments:", json.dumps(assigns, indent=1)[:500])
execs = get("/rest/v1/workflow_executions?select=id,workflow_id,status,contact_id&order=id.desc&limit=3")
print("executions:", json.dumps(execs, indent=1)[:500])
PY

echo
echo "=== 6. adopt-winner (real action) ==="
ADOPT=$(curl -sS -m 10 -X POST "$BASE/api/experiments/$EXP_ID/adopt-winner" \
  -H "Content-Type: application/json" -d "{\"workflowId\":$VA_ID}")
echo "$ADOPT"

echo
echo "=== 7. stats endpoint (replied/messaged + weight) ==="
STATS=$(curl -sS -m 10 "$BASE/api/experiments/$EXP_ID/stats")
echo "$STATS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('totals:', d['totals'])
for v in d['variants']:
    print('variant', v['workflowId'], v['name'], 'weight', v['weight'], 'active', v['active'], 'assigned', v['assigned'], 'messaged', v['messaged'], 'replied', v['replied'], 'rate', v['replyRate'])"

echo
echo "=== 8. cleanup QA experiment ==="
curl -sS -m 10 -X DELETE "$BASE/api/experiments/$EXP_ID" >/dev/null && echo "deleted exp $EXP_ID"

echo
echo "DONE"
