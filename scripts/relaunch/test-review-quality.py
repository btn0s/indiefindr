"""Detector contracts: real spike, overlap, sparse data, and eligibility semantics."""
import datetime,json,pathlib,unittest
from review_quality import analyze,eligible,momentum,rated_low
class ReviewQuality(unittest.TestCase):
 def test_positive_dominant_spikes_are_not_bombs(self):
  result=analyze(json.loads((pathlib.Path(__file__).parent/'fixtures/big-walk-20261113.json').read_text()),91)
  self.assertFalse(any(w['start']=='2026-11-09' for w in result['bomb_windows']))
 def test_negative_dominant_window(self):
  rows=[dict(date=i*86400,recommendations_up=10,recommendations_down=1) for i in range(20)]
  rows[-1].update(recommendations_up=20,recommendations_down=100)
  result=analyze(dict(success=1,results=dict(recent=rows)),60)
  self.assertEqual(len(result['bomb_windows']),1)
  self.assertEqual(result['bomb_windows'][0]['down'],100)
  self.assertGreater(result['clean_score'],70)
 def test_dominance_is_checked_after_adjacent_bins_merge(self):
  rows=[dict(date=i*86400,recommendations_up=10,recommendations_down=1) for i in range(20)]
  rows[-2].update(recommendations_up=200,recommendations_down=50)
  rows[-1].update(recommendations_up=1,recommendations_down=100)
  result=analyze(dict(success=1,results=dict(recent=rows)),60)
  self.assertEqual(result['bomb_windows'],[])
  self.assertEqual(result['clean_score'],60)
 def test_unrated_stays(self):
  for count in [0,1,9]:
   self.assertTrue(eligible(dict(review_count=count,review_positive_pct=0,clean_score=0)))
   self.assertFalse(rated_low(0,count))
 def test_score_threshold(self):
  self.assertTrue(eligible(dict(review_count=10,review_positive_pct=70)))
  self.assertFalse(eligible(dict(review_count=10,review_positive_pct=69)))
  self.assertTrue(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[dict(up=1,down=100)])))
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
 def test_momentum_ranks_current_pace_over_lifetime_size(self):
  now=datetime.datetime(2026,11,14,6,tzinfo=datetime.timezone.utc);today=int(now.timestamp())//86400*86400
  def histogram(daily_votes,weekly_votes=(),weeks_back=0,down=0):
   recent=[dict(date=today-(30-i)*86400,recommendations_up=v,recommendations_down=down) for i,v in enumerate(daily_votes)]
   rollups=[dict(date=today-(30+7*(weeks_back-i))*86400,recommendations_up=v,recommendations_down=0) for i,v in enumerate(weekly_votes)]
   return dict(success=1,results=dict(rollup_type='week',recent=[r for r in recent if r['recommendations_up'] or r is recent[-1]],rollups=rollups))
  launch=momentum(histogram([0]*24+[40]*6+[3]),95,now)
  breakout=momentum(histogram([10]*16+[40]*14,[70]*8,8),95,now)
  self.assertEqual(launch['recent_reviews'],240)
  self.assertGreater(launch['momentum'],breakout['momentum'])
  self.assertAlmostEqual(breakout['momentum'],(560+20)/(140+20),places=2)
  self.assertIsNone(momentum(histogram([20]*30,[140]*8,8),95,now))
  ea_relaunch=histogram([2]*16+[40]*14,[10]*60,60)
  self.assertIsNone(momentum(ea_relaunch,95,now))
  self.assertGreater(momentum(ea_relaunch,95,now,'2026-11-04')['momentum'],3)
  self.assertIsNone(momentum(histogram([0]*24+[40]*6,down=20),95,now))
if __name__=='__main__':unittest.main()
