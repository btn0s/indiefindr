"""Verify all stored model targets using narrow reads instead of large joins."""
from selection import SLATE_SIZE,POPULARITY_CAPS,MODEL_VERSION

def verify_model_slates(query,expected_sizes=None):
 games={g['appid']:g for g in query('select appid,is_indie,review_count from public.games')}
 stored=query("select appid,array_agg(rec_appid order by rank) targets,min(rank) first_rank,max(rank) last_rank,min(model_version) min_version,max(model_version) max_version from public.game_recs where source='model' group by appid")
 sizes={appid:0 for appid in games};non_indie=bad_caps=invalid=0
 for slate in stored:
  appid=slate['appid'];targets=slate['targets'];assert appid in games
  sizes[appid]=len(targets)
  invalid+=int(len(targets)>SLATE_SIZE or len(set(targets))!=len(targets) or appid in targets or slate['first_rank']!=1 or slate['last_rank']!=len(targets) or slate['min_version']!=MODEL_VERSION or slate['max_version']!=MODEL_VERSION)
  non_indie+=sum(not games[t]['is_indie'] for t in targets)
  bad_caps+=int(any(sum(games[t]['review_count']>=threshold for t in targets)>cap for threshold,cap in POPULARITY_CAPS))
 if expected_sizes is not None:assert sizes==expected_sizes,'Stored per-game slate sizes differ from the prepared generation'
 checks={'non_indie_targets':non_indie,'cap_violations':bad_caps,'invalid_model_slates':invalid}
 assert all(value==0 for value in checks.values()),checks
 return checks
