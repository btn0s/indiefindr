"""Install the authorized native Mac nightly job; no agent/model API calls."""
import os,pathlib,plistlib,subprocess
from nightly_release import build_snapshot
root=pathlib.Path(__file__).resolve().parents[2];label='gg.indiefindr.offline-ingest';directory=pathlib.Path.home()/'Library/LaunchAgents';directory.mkdir(exist_ok=True)
path=directory/(label+'.plist');logs=root/'data/nightly';logs.mkdir(parents=True,exist_ok=True)
release=build_snapshot(root)
job={'Label':label,'ProgramArguments':['/bin/bash',str(release/'scripts/relaunch/rebuild.sh')],'WorkingDirectory':str(release),'StartCalendarInterval':{'Hour':3,'Minute':15},'RunAtLoad':False,'ProcessType':'Background','Nice':10,'StandardOutPath':str(logs/'stdout.log'),'StandardErrorPath':str(logs/'stderr.log')}
with path.open('wb') as f:plistlib.dump(job,f)
subprocess.run(['launchctl','bootout',f'gui/{os.getuid()}/{label}'],capture_output=True)
subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(path)],check=True)
print('Installed',label,'at 03:15 local time');print('Plist:',path);print('Logs:',logs);print('Pinned code:',release)
