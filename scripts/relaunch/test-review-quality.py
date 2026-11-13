"""Detector contracts: real spike, overlap, sparse data, and eligibility semantics."""
import json,pathlib,unittest
from review_quality import analyze,eligible,rated_low
class ReviewQuality(unittest.TestCase):
 def test_big_walk(self):
  result=analyze(json.loads((pathlib.Path(__file__).parent/'fixtures/big-walk-20261113.json').read_text()),91)
  self.assertTrue(any(w['start']=='2026-11-09' and w['end']=='2026-11-11' for w in result['bomb_windows']))
  window=next(w for w in result['bomb_windows'] if w['start']=='2026-11-09')
  self.assertEqual((window['up'],window['down']),(426+652+547,366+130+51))
 def test_unrated_stays(self):
  for count in [0,1,9]:
   self.assertTrue(eligible(dict(review_count=count,review_positive_pct=0,clean_score=0)))
   self.assertFalse(rated_low(0,count))
 def test_score_threshold(self):
  self.assertTrue(eligible(dict(review_count=10,review_positive_pct=70)))
  self.assertFalse(eligible(dict(review_count=10,review_positive_pct=69)))
  self.assertTrue(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91)))
 def test_months_have_actual_duration(self):
  data=dict(success=1,results=dict(rollup_type='month',recent=[],rollups=[dict(date=1706745600,recommendations_up=100,recommendations_down=29)]))
  result=analyze(data,50)
  self.assertEqual(result['total_down'],29)
  self.assertEqual(result['median_daily_down'],1)
 def test_no_data_does_not_rescue(self):
  self.assertEqual(analyze(dict(success=1,results={}),42)['clean_score'],42)
 def test_overlap_is_counted_once(self):
  days=[dict(date=i*86400,recommendations_up=10,recommendations_down=1) for i in range(3,7)]
  week=dict(date=0,recommendations_up=70,recommendations_down=7)
  result=analyze(dict(success=1,results=dict(recent=days,rollups=[week],rollup_type='week')),50)
  self.assertEqual((result['total_up'],result['total_down']),(70,7))
if __name__=='__main__':unittest.main()
