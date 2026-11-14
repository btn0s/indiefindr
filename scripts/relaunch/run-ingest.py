"""Native Mac scheduler entrypoint: single-run lock and durable stage recovery."""
import datetime,fcntl,json,os,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];os.chdir(ROOT)
os.environ.update(PYTHONDONTWRITEBYTECODE='1',HF_HUB_OFFLINE='1',TOKENIZERS_PARALLELISM='false',OMP_NUM_THREADS='2',OPENBLAS_NUM_THREADS='2',MKL_NUM_THREADS='2',VECLIB_MAXIMUM_THREADS='2',HF_HOME=str(ROOT/'data/huggingface'))
python=ROOT/'scripts/recommender/.venv/bin/python'
ranker_python=ROOT/'data/ranker-env/bin/python';pointer=ROOT/'data/active-run.json'
def save(state):
 tmp=pointer.with_suffix('.tmp');tmp.write_text(json.dumps(state,indent=2));tmp.replace(pointer)
with (ROOT/'data/ingest.lock').open('a') as lock:
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:print('Offline ingest already running');raise SystemExit
 state=json.loads(pointer.read_text()) if pointer.exists() else None
 if not state or state['status']=='published':
  run_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');run=ROOT/'data/runs'/run_id;run.mkdir(parents=True,exist_ok=True)
  state={'run':str(run),'source':str(run/'source'),'model':str(run/'model'),'import':str(run/'import'),'completed':[],'status':'running'};save(state)
 run=pathlib.Path(state['run']);source=pathlib.Path(state['source']);artifacts=pathlib.Path(state['model']);imports=pathlib.Path(state['import'])
 def execute(script,*args):
  interpreter=ranker_python if script=='scripts/recommender/run.py' and args and args[0]=='score' else python
  subprocess.run([str(interpreter),str(ROOT/script),*map(str,args)],check=True)
 def stage(name,script,*args):
  if name in state['completed']:return
  state['stage']=name;state['status']='running';save(state)
  execute(script,*args)
  state['completed'].append(name);save(state)
 try:
  stage('download','scripts/relaunch/steam-catalog.py','--refresh')
  previous=[];built=ROOT/'data/latest-built-source.txt'
  if built.exists() and pathlib.Path(built.read_text().strip())!=source:previous=['--previous',built.read_text().strip()]
  stage('normalize','scripts/relaunch/normalize-steam.py','--out',source,*previous)
  (source/'llm_slates.json').write_bytes((ROOT/'data/relaunch-source/llm_slates.json').read_bytes());built.write_text(str(source)+'\n')
  stage('prices','scripts/relaunch/us-prices.py','--source',source)
  if 'encode' not in state['completed']:execute('scripts/relaunch/capacity.py','--source',source)
  stage('review-summaries','scripts/relaunch/refresh-review-summaries.py','--source',source)
  prior_quality=ROOT/'data/latest-review-quality.json'
  if prior_quality.exists() and not (source/'review-quality.json').exists():(source/'review-quality.json').write_bytes(prior_quality.read_bytes())
  stage('reviews','scripts/relaunch/check-reviews.py','--source',source,'--refresh')
  prior_quality.write_bytes((source/'review-quality.json').read_bytes())
  stage('encode','scripts/recommender/run.py','encode','--source',source,'--artifacts',artifacts)
  stage('score','scripts/recommender/run.py','score','--source',source,'--artifacts',artifacts)
  stage('prepare','scripts/relaunch/prepare.py',source,'--out',imports)
  stage('publish','scripts/relaunch/publish.py','--data',imports)
  stage('review-history','scripts/relaunch/publish-review-history.py','--source',source)
  stage('media','scripts/relaunch/media.py','--top','250000')
  stage('search','scripts/relaunch/publish-search.py','--games',imports/'games.jsonl')
  stage('verify','scripts/relaunch/verify-publication.py')
  state.pop('failed_script',None);state.pop('exit_code',None)
  state['status']='published';state['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(state)
  (ROOT/'data/latest-published-run.txt').write_text(str(run)+'\n');(run/'result.json').write_text(json.dumps(state))
 except subprocess.CalledProcessError as error:
  state['status']='failed';state['failed_script']=pathlib.Path(error.cmd[1]).name;state['exit_code']=error.returncode;save(state)
  (run/'result.json').write_text(json.dumps(state));raise SystemExit(error.returncode)
