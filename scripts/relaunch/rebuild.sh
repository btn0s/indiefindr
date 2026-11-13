#!/bin/bash
# A complete offline catalog generation; never modifies production or plan billing.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONDONTWRITEBYTECODE=1
export HF_HUB_OFFLINE=1
export OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 MKL_NUM_THREADS=2 VECLIB_MAXIMUM_THREADS=2
export HF_HOME="$PWD/data/huggingface"
python_bin="$PWD/scripts/recommender/.venv/bin/python"
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
run_dir="$PWD/data/runs/$run_id"
mkdir -p "$run_dir"
if ! mkdir data/relaunch-run.lock 2>/dev/null; then
  echo 'Another offline ingest is already running.'
  exit 0
fi
trap 'rmdir data/relaunch-run.lock' EXIT
"$python_bin" scripts/relaunch/steam-catalog.py --refresh
previous_args=()
if [ -f data/latest-built-source.txt ]; then
  previous_args=(--previous "$(cat data/latest-built-source.txt)")
fi
"$python_bin" scripts/relaunch/normalize-steam.py --out "$run_dir/source" "${previous_args[@]}"
cp data/relaunch-source/llm_slates.json "$run_dir/source/llm_slates.json"
printf '%s\n' "$run_dir/source" > data/latest-built-source.txt
"$python_bin" scripts/relaunch/capacity.py --source "$run_dir/source"
"$python_bin" scripts/recommender/run.py encode --source "$run_dir/source" --artifacts "$run_dir/model"
"$python_bin" scripts/recommender/run.py score --source "$run_dir/source" --artifacts "$run_dir/model"
"$python_bin" scripts/relaunch/prepare.py "$run_dir/source" --out "$run_dir/import"
"$python_bin" scripts/relaunch/publish.py --data "$run_dir/import"
printf '%s\n' "$run_dir" > data/latest-published-run.txt
