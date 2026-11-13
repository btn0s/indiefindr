"""Entitlement-aware publication guard; never changes plans or purchases capacity."""
import json,pathlib,urllib.request,argparse
PROJECT_REF='rqcqlpoxtdddjcylhopk'
def check_capacity(management,game_count,rec_count):
 project=management(f'projects/{PROJECT_REF}');org=management('organizations/'+project['organization_id']);plan=org['plan']
 limit=500_000_000 if plan=='free' else 8_000_000_000
 budget=int(limit*.9)
 sql="select pg_database_size(current_database()) as database_bytes,(select count(*) from games) as games,(select count(*) from game_recs) as recs,(select pg_total_relation_size('public.games')) as games_bytes,(select pg_total_relation_size('public.game_recs')) as recs_bytes"
 stats=management(f'projects/{PROJECT_REF}/database/query',{'query':sql})[0]
 projected=stats['database_bytes']+max(0,game_count-stats['games'])*stats['games_bytes']/max(stats['games'],1)+max(0,rec_count-stats['recs'])*stats['recs_bytes']/max(stats['recs'],1)
 return {'plan':plan,'current_database_bytes':stats['database_bytes'],'conservative_projected_bytes':round(projected),'disk_entitlement_bytes':limit,'operating_budget_bytes':budget,'publication_allowed':projected<budget}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);a=p.parse_args()
 from catalog import is_indie
 rows=json.loads((a.source/'data/catalog.json').read_text())['rows'];tags=json.loads((a.source/'data/steam_tags.json').read_text());eligible={r['appid'] for r in rows if is_indie(r,tags[str(r['appid'])]['tags'])};ids={r['appid'] for r in rows}
 slates=json.loads((a.source/'llm_slates.json').read_text())['slates'];llm_count=sum(len({s['suggested_appid'] for s in slate['suggestions'] if s['suggested_appid'] in eligible and s['suggested_appid']!=slate['source_appid']}) for slate in slates if slate['source_appid'] in ids)
 values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);assert values['RELAUNCH_PROJECT_REF']==PROJECT_REF
 def management(path,data=None):
  req=urllib.request.Request('https://api.supabase.com/v1/'+path,headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'},data=json.dumps(data).encode() if data is not None else None)
  with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
 report=check_capacity(management,len(rows),len(rows)*10+llm_count);print(json.dumps(report),flush=True)
 if not report['publication_allowed']:raise SystemExit('Capacity approval required before expanded publication; no writes made.')
