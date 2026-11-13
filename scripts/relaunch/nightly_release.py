"""Pin nightly code independently of the mutable source checkout."""
import hashlib,json,os,pathlib

def build_snapshot(root):
 root=pathlib.Path(root).resolve();files={}
 for directory,dirs,names in os.walk(root/'scripts'):
  dirs[:]=[d for d in dirs if d not in {'.venv','__pycache__','.git'}]
  for name in names:
   source=pathlib.Path(directory)/name
   files[str(source.relative_to(root))]=source.read_bytes()
 policy={};exec(compile(files['scripts/relaunch/selection.py'],'selection.py','exec'),policy)
 assert policy.get('SLATE_SIZE',0)>=24,'Refusing to install a policy shorter than the published 24-target minimum'
 assert policy['select_targets'].__defaults__[0]==policy['SLATE_SIZE']
 digest=hashlib.sha256()
 for name,body in sorted(files.items()):digest.update(name.encode()+b'\0'+body+b'\0')
 release=root/'data/nightly/releases'/digest.hexdigest();release.mkdir(parents=True,exist_ok=True)
 for name,body in files.items():
  target=release/name;target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():assert target.read_bytes()==body,f'Pinned code changed: {target}'
  else:target.write_bytes(body);target.chmod(0o444)
 for name in ['data','.env.steam','.env.relaunch-admin','scripts/recommender/.venv']:
  target=release/name;target.parent.mkdir(parents=True,exist_ok=True)
  if target.is_symlink():assert target.resolve()==(root/name).resolve()
  else:target.symlink_to(root/name,target_is_directory=(root/name).is_dir())
 (release/'release.json').write_text(json.dumps({'source':str(root),'sha256':digest.hexdigest(),'slate_size':policy['SLATE_SIZE'],'model_version':policy['MODEL_VERSION']},indent=2))
 return release
