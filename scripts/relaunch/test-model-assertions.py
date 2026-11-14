import unittest
from model_assertions import verify_model_slates
from selection import MODEL_VERSION
class AssertionsTest(unittest.TestCase):
 def fixture(self):
  games=[dict(appid=i,is_indie=True,review_count=0) for i in range(25)]
  slate=dict(appid=0,targets=list(range(1,25)),first_rank=1,last_rank=24,min_version=MODEL_VERSION,max_version=MODEL_VERSION)
  return games,slate
 def verify(self,games,slate):
  return verify_model_slates(lambda sql:games if 'from public.games' in sql else [] if "source='llm'" in sql else [slate])
 def test_valid_full_slate(self):
  self.assertEqual(self.verify(*self.fixture()),dict(low_score_targets=0,non_indie_targets=0,cap_violations=0,invalid_model_slates=0))
 def test_low_score_target_without_rescue_rejected(self):
  games,slate=self.fixture();games[1].update(review_count=100,review_positive_pct=60,clean_score=90,bomb_windows=[])
  with self.assertRaises(AssertionError):self.verify(games,slate)
 def test_non_indie_target_rejected(self):
  games,slate=self.fixture();games[1]['is_indie']=False
  with self.assertRaises(AssertionError):self.verify(games,slate)
 def test_nested_popularity_cap_rejected(self):
  games,slate=self.fixture()
  for g in games[1:7]:g['review_count']=50000
  with self.assertRaises(AssertionError):self.verify(games,slate)
 def test_rank_gap_rejected(self):
  games,slate=self.fixture();slate['last_rank']=25
  with self.assertRaises(AssertionError):self.verify(games,slate)
if __name__=='__main__':unittest.main()
