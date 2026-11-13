#!/usr/bin/env bash
# Non-production end-to-end check for the separately selected browser profile.
set -euo pipefail
umask 077
garage="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sightline="$(cd "${1:?Pass the Sightline checkout path}" && pwd)"
work="$(mktemp -d)"; network=""; lab=""; image="sightline-garage-browser-$$-$RANDOM"
cleanup() {
  [ -z "$lab" ] || docker rm -f "$lab" >/dev/null 2>&1 || true
  [ -z "$network" ] || docker network rm "$network" >/dev/null 2>&1 || true
  docker image rm "$image" >/dev/null 2>&1 || true
  rm -rf -- "$work"
}
trap cleanup EXIT
docker build -q -f "$sightline/containers/verification/Dockerfile.verifier-browser" -t "$image" "$sightline" >/dev/null
network="$(docker network create --internal "sightline-garage-browser-$$-$RANDOM")"
mkdir -p "$work/results"
cat > "$work/pending.json" <<'JSON'
{"schema":"garage.sightline.pending/v1","state":"awaiting_approval","repository":"example/synthetic-lab","issue":1,"finding_id":"VULN-001"}
JSON
for phase in baseline candidate; do
  input="$work/$phase"
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$sightline" python3 "$sightline/test/verification-pilot/make_browser_records.py" "$phase" "$input"
  lab="$(docker run -d --network "$network" --network-alias lab --read-only --cap-drop ALL --security-opt no-new-privileges \
    -e "LAB_MODE=$phase" --mount "type=bind,src=$sightline/test/verification-pilot/browser_lab.py,dst=/lab.py,readonly" python:3.12-slim python /lab.py)"
  for _ in $(seq 1 40); do
    if docker exec "$lab" python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8080/control", timeout=1)' >/dev/null 2>&1; then break; fi
    sleep .25
  done
  args=(run --pending "$work/pending.json" --request "$input/request.json" --approval "$input/approval.json" \
    --target "$input/target.json" --recipe "$input/recipe.json" --output-dir "$work/results" --image "$image" --network "$network" --profile browser)
  result="$(node "$garage/garage/scripts/sightline.mjs" "${args[@]}")"
  python3 -c 'import json,sys; x=json.loads(sys.argv[1]); assert x["state"] == ("confirmed" if sys.argv[2] == "baseline" else "not_reproduced"); assert len(x["launch_profile"]) == 64' "$result" "$phase"
  repeated="$(node "$garage/garage/scripts/sightline.mjs" "${args[@]}")"
  python3 -c 'import json,sys; a=json.loads(sys.argv[1]); b=json.loads(sys.argv[2]); assert b["duplicate"] and a["run_id"] == b["run_id"]' "$result" "$repeated"
  echo "PASS Garage browser $phase and duplicate suppression"
  docker rm -f "$lab" >/dev/null; lab=""
done
