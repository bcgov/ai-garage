#!/usr/bin/env bash
# Synthetic local-only end-to-end test. Requires a non-root Linux Docker user.
set -euo pipefail
umask 077
garage="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sightline="$(cd "${1:?Pass the Sightline checkout path}" && pwd)"
work="$(mktemp -d)"
network=""
provider_network=""
lab=""
model=""
service_pid=""
suffix="$$-$RANDOM"
verifier_image="sightline-e2e-verifier:$suffix"
lab_image="sightline-e2e-lab:$suffix"
copilot_image="sightline-e2e-copilot:$suffix"
model_image="sightline-e2e-model:$suffix"
cleanup() {
    if [ -n "$service_pid" ]; then kill "$service_pid" >/dev/null 2>&1 || true; wait "$service_pid" 2>/dev/null || true; fi
    if [ -n "$lab" ]; then docker rm -f "$lab" >/dev/null 2>&1 || true; fi
    if [ -n "$model" ]; then docker rm -f "$model" >/dev/null 2>&1 || true; fi
    if [ -n "$network" ]; then docker network rm "$network" >/dev/null 2>&1 || true; fi
    if [ -n "$provider_network" ]; then docker network rm "$provider_network" >/dev/null 2>&1 || true; fi
    docker image rm "$verifier_image" "$lab_image" "$copilot_image" "$model_image" >/dev/null 2>&1 || true
    rm -rf -- "$work"
}
trap cleanup EXIT

docker build -q -f "$sightline/containers/verification/Dockerfile.verifier" -t "$verifier_image" "$sightline" >/dev/null
docker build -q -f "$sightline/test/verification-pilot/Dockerfile" -t "$lab_image" "$sightline/test/verification-pilot" >/dev/null
docker build -q -f "$sightline/containers/verification/Dockerfile.copilot" -t "$copilot_image" "$sightline" >/dev/null
docker build -q -f "$sightline/test/verification-copilot/Dockerfile.fake-model" -t "$model_image" "$sightline/test/verification-copilot" >/dev/null
network="$(docker network create --internal "sightline-e2e-$suffix")"
provider_network="$(docker network create --internal "sightline-e2e-provider-$suffix")"
model="$(docker run -d --network "$provider_network" --network-alias fake-model --read-only --cap-drop ALL \
    --security-opt no-new-privileges --pids-limit 64 --memory 128m "$model_image")"
model_ready=0
for _ in $(seq 1 40); do
    if docker exec "$model" python3 -c 'import socket; socket.create_connection(("127.0.0.1",8080),timeout=1).close()' >/dev/null 2>&1; then model_ready=1; break; fi
    sleep 0.25
done
if [ "$model_ready" -ne 1 ]; then echo "Synthetic model did not start." >&2; exit 1; fi
mkdir -p "$work/service" "$work/results" "$work/service-state" "$work/records/requests" "$work/records/approvals" "$work/records/targets" "$work/records/recipes"
cat > "$work/service/garage.config.json" <<'JSON'
{"version":1,"project":"synthetic-lab","profile":"delivery","live_proof":{"enabled":true},"sightline":{"enabled":true}}
JSON
git -C "$work/service" init -q
git -C "$work/service" config user.email synthetic@example.invalid
git -C "$work/service" config user.name "Synthetic Test"
mkdir -p "$work/service/src" "$work/service/docs/live-proof/VULN-001"
printf 'baseline\n' > "$work/service/src/lab-mode"
git -C "$work/service" add .
git -C "$work/service" commit -qm "synthetic baseline"
revision="$(git -C "$work/service" rev-parse HEAD)"
cat > "$work/event.json" <<'JSON'
{"repository":{"full_name":"example/synthetic-lab"},"issue":{"number":1,"state":"open","title":"Synthetic finding","body":"Finding-Id: VULN-001\nLive-proof: required\nSECRET-SHOULD-NOT-LEAK","labels":[]}}
JSON
node "$garage/garage/scripts/sightline.mjs" prepare --root "$work/service" --event "$work/event.json" --output "$work/pending.json" >/dev/null
port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
python3 - "$work" "$verifier_image" "$network" "$copilot_image" "$provider_network" "$port" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
config = {"schema":"garage.sightline.service/v1", "service_root":str(root / "service"), "records_dir":str(root / "records"),
          "output_dir":str(root / "results"), "state_dir":str(root / "service-state"), "verifier_image":sys.argv[2],
          "target_network":sys.argv[3], "copilot_image":sys.argv[4], "copilot_network":sys.argv[5],
          "synthetic_provider":True, "max_concurrent":1, "port":int(sys.argv[6])}
(root / "service-config.json").write_text(json.dumps(config))
PY
export GARAGE_SIGHTLINE_PORT="$port"
export GARAGE_SIGHTLINE_TOKEN="synthetic-service-token-0123456789-abcdef"
node "$garage/garage/scripts/sightline-service.mjs" --config "$work/service-config.json" >"$work/service.log" 2>&1 &
service_pid=$!
pending_api=""
for _ in $(seq 1 40); do
    if pending_api="$(node "$garage/garage/scripts/sightline-client.mjs" pending --event "$work/event.json" 2>/dev/null)"; then break; fi
    sleep 0.25
done
if [ -z "$pending_api" ]; then cat "$work/service.log" >&2; echo "Synthetic service did not start." >&2; exit 1; fi
pending_ref="$(python3 -c 'import json,sys; value=json.loads(sys.argv[1]); assert value["state"] == "awaiting_approval"; print(value["pending_ref"])' "$pending_api")"

for phase in baseline candidate; do
    input="$work/$phase"
    PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$sightline" python3 "$sightline/test/verification-pilot/make_records.py" "$phase" "$input" --revision "$revision"
    mode="$(git -C "$work/service" show "$revision:src/lab-mode")"
    lab="$(docker run -d --network "$network" --network-alias lab --read-only --cap-drop ALL \
        --security-opt no-new-privileges --pids-limit 64 --memory 128m -e "LAB_MODE=$mode" "$lab_image")"
    ready=0
    for _ in $(seq 1 40); do
        if docker exec "$lab" python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8080/control", timeout=1).read()' >/dev/null 2>&1; then ready=1; break; fi
        sleep 0.25
    done
    if [ "$ready" -ne 1 ]; then echo "Synthetic lab did not start." >&2; exit 1; fi
    args=(run --pending "$work/pending.json" --request "$input/request.json" --approval "$input/approval.json"
        --target "$input/target.json" --recipe "$input/recipe.json" --output-dir "$work/results"
        --image "$verifier_image" --network "$network" --copilot-image "$copilot_image"
        --copilot-network "$provider_network" --synthetic-provider)
    cp "$input/request.json" "$work/records/requests/lab-$phase.json"
    cp "$input/approval.json" "$work/records/approvals/lab-approval-$phase.json"
    cp "$input/target.json" "$work/records/targets/lab-$phase.json"
    cp "$input/recipe.json" "$work/records/recipes/lab-recipe-v1.json"
    queued="$(node "$garage/garage/scripts/sightline-client.mjs" run --pending-ref "$pending_ref" --request-ref "lab-$phase")"
    job_id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["job_id"])' "$queued")"
    state=""
    for _ in $(seq 1 120); do
        state="$(node "$garage/garage/scripts/sightline-client.mjs" status --job-id "$job_id")"
        if python3 -c 'import json,sys; sys.exit(0 if json.loads(sys.argv[1])["state"] not in ("queued","running") else 1)' "$state"; then break; fi
        sleep 0.25
    done
    python3 -c 'import json,sys; s=json.loads(sys.argv[1]); assert s["state"] == ("confirmed" if sys.argv[2] == "baseline" else "not_reproduced") and s["provider"] == "copilot-cli" and s["advisory"] == "completed"' "$state" "$phase"
    duplicate="$(node "$garage/garage/scripts/sightline-client.mjs" run --pending-ref "$pending_ref" --request-ref "lab-$phase")"
    python3 -c 'import json,sys; a=json.loads(sys.argv[1]); b=json.loads(sys.argv[2]); assert b["duplicate"] and a["run_id"] == b["run_id"]' "$state" "$duplicate"
    run_id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["run_id"])' "$state")"
    python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); assert a["provider"] == "copilot-cli" and a["status"] == "completed"' "$work/results/$job_id/advisory/advisory.json"
    proof_file="$work/service/docs/live-proof/VULN-001/$([ "$phase" = baseline ] && printf before || printf after).md"
    node "$garage/garage/scripts/sightline.mjs" export --pending "$work/pending.json" \
        --result "$work/results/$job_id/runs/$run_id/result.json" --reviewer synthetic-reviewer \
        --revision "$revision" --output "$proof_file" --human-reviewed >/dev/null
    if [ "$phase" = baseline ]; then
        grep -q '^verdict: confirmed$' "$proof_file"
        if node "$garage/garage/scripts/sightline.mjs" run --pending "$work/pending.json" --request "$input/request.json" \
            --approval "$input/approval.json" --target "$input/target.json" --recipe "$input/recipe.json" \
            --output-dir "$work/results" --image "$verifier_image" --network bridge >/dev/null 2>&1; then
            echo "A non-internal network unexpectedly succeeded." >&2; exit 1
        fi
        if node "$garage/garage/scripts/sightline.mjs" run --pending "$work/pending.json" --request "$input/request.json" \
            --approval "$input/approval.json" --target "$input/target.json" --recipe "$input/recipe.json" \
            --output-dir "$work/results" --image "$verifier_image" --network "$network" \
            --copilot-image "$copilot_image" --copilot-network "$network" --synthetic-provider >/dev/null 2>&1; then
            echo "A shared target and model network unexpectedly succeeded." >&2; exit 1
        fi
        if privileged="$(docker run --rm --network "$network" --read-only --cap-drop ALL --security-opt no-new-privileges \
            --user 0:0 --tmpfs /output:rw,nosuid,size=16m --mount "type=bind,src=$input,dst=/input,readonly" \
            "$verifier_image" verify --request /input/request.json --approval /input/approval.json \
            --target /input/target.json --recipe /input/recipe.json --output-dir /output)"; then
            echo "A privileged verifier unexpectedly succeeded." >&2; exit 1
        fi
        python3 -c 'import json,sys; assert json.loads(sys.argv[1])["status"] == "blocked"' "$privileged"
        cp "$input/target.json" "$work/altered-target.json"
        printf ' \n' >> "$work/altered-target.json"
        if node "$garage/garage/scripts/sightline.mjs" run --pending "$work/pending.json" --request "$input/request.json" \
            --approval "$input/approval.json" --target "$work/altered-target.json" --recipe "$input/recipe.json" \
            --output-dir "$work/results" --image "$verifier_image" --network "$network" \
            --copilot-image "$copilot_image" --copilot-network "$provider_network" --synthetic-provider >/dev/null 2>&1; then
            echo "A duplicate with changed records unexpectedly succeeded." >&2; exit 1
        fi
        denied="$work/denied"
        PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$sightline" python3 "$sightline/test/verification-pilot/make_records.py" baseline "$denied"
        python3 - "$denied" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for name in ("request", "approval"):
    file = root / (name + ".json")
    value = json.loads(file.read_text())
    if name == "request": value["approval_ref"] = "denied-approval"
    else:
        value["approval_id"] = "denied-approval"
        value["status"] = "pending"
    file.write_text(json.dumps(value))
PY
        if rejected="$(node "$garage/garage/scripts/sightline.mjs" run --pending "$work/pending.json" \
            --request "$denied/request.json" --approval "$denied/approval.json" --target "$denied/target.json" \
            --recipe "$denied/recipe.json" --output-dir "$work/results" --image "$verifier_image" --network "$network")"; then
            echo "An unapproved request unexpectedly succeeded." >&2; exit 1
        fi
        python3 -c 'import json,sys; assert json.loads(sys.argv[1])["state"] == "blocked"' "$rejected"
        no_provider="$work/no-provider"
        PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$sightline" python3 "$sightline/test/verification-pilot/make_records.py" baseline "$no_provider"
        python3 - "$no_provider" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for name in ("request", "approval"):
    file = root / (name + ".json")
    value = json.loads(file.read_text())
    value["approval_ref" if name == "request" else "approval_id"] = "missing-provider-approval"
    file.write_text(json.dumps(value))
PY
        if unavailable="$(env -u COPILOT_GITHUB_TOKEN -u COPILOT_MODEL node "$garage/garage/scripts/sightline.mjs" run \
            --pending "$work/pending.json" --request "$no_provider/request.json" --approval "$no_provider/approval.json" \
            --target "$no_provider/target.json" --recipe "$no_provider/recipe.json" --output-dir "$work/results" \
            --image "$verifier_image" --network "$network" --copilot-image "$copilot_image" --copilot-network "$provider_network")"; then
            echo "A requested Copilot run without a credential unexpectedly succeeded." >&2; exit 1
        fi
        python3 -c 'import json,sys; a=json.loads(sys.argv[1]); assert a["state"] == "confirmed" and a["advisory"] == "blocked"' "$unavailable"
    else
        grep -q '^verdict: closed$' "$proof_file"
    fi
    echo "PASS synthetic $phase: $(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["state"])' "$state"), isolated Copilot advisory, duplicate suppressed, reviewed draft created"
    docker rm -f "$lab" >/dev/null
    lab=""
    git -C "$work/service" add "$proof_file"
    git -C "$work/service" commit -qm "reviewed synthetic $phase proof"
    if [ "$phase" = baseline ]; then
        base_sha="$(git -C "$work/service" rev-parse HEAD)"
        printf 'candidate\n' > "$work/service/src/lab-mode"
        git -C "$work/service" add src/lab-mode
        git -C "$work/service" commit -qm "synthetic candidate"
        revision="$(git -C "$work/service" rev-parse HEAD)"
    fi
done
head_sha="$(git -C "$work/service" rev-parse HEAD)"
node "$garage/garage/tests/sightline-e2e-gate.mjs" "$work/service" "$base_sha" "$head_sha" fresh
printf 'changed after verification\n' > "$work/service/src/lab-mode"
git -C "$work/service" add src/lab-mode
git -C "$work/service" commit -qm "change after verification"
node "$garage/garage/tests/sightline-e2e-gate.mjs" "$work/service" "$base_sha" "$(git -C "$work/service" rev-parse HEAD)" stale
echo "PASS pending approval blocks an active test"
echo "PASS non-internal/shared networks and privileged verifiers are rejected"
echo "PASS missing Copilot credentials block the requested advisory"
