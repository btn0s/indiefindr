"""Finish the already-running full-catalog score without restarting compute.

Run on devbox only. A durable ingest manifest resumes publication after failure;
install the nightly job only once the initial generation has fully published.
"""
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
source = ROOT / 'data/full-source'
artifacts = ROOT / 'data/full-model'
pointer = ROOT / 'data/active-run.json'
python = ROOT / 'scripts/recommender/.venv/bin/python'
while not (source / 'slates_indie.jsonl').exists():
    processes = subprocess.check_output(['ps', '-axo', 'command'], text=True)
    if 'run.py score --source data/full-source --artifacts data/full-model' not in processes:
        raise SystemExit('Existing scorer stopped without a finished slate file; inspect full-ranking.log')
    time.sleep(30)
if not pointer.exists():
    run = ROOT / 'data/runs/full-expansion'
    run.mkdir(parents=True, exist_ok=True)
    state = {'run': str(run), 'source': str(source), 'model': str(artifacts),
             'import': str(ROOT / 'data/full-import'),
             'completed': ['download', 'normalize', 'encode', 'score'], 'status': 'running'}
    tmp = pointer.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(pointer)
subprocess.run([str(python), str(ROOT / 'scripts/relaunch/run-ingest.py')], cwd=ROOT, check=True)
subprocess.run([str(python), str(ROOT / 'scripts/relaunch/install-nightly.py')], cwd=ROOT, check=True)
print('Full expansion published; nightly installed', flush=True)
