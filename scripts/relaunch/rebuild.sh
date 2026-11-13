#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
exec scripts/recommender/.venv/bin/python scripts/relaunch/run-ingest.py
