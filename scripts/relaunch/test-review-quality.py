"""Detector behaviour: bombs vs declines, Steam labels, spikes that are not bombs, sparse data, eligibility."""
import calendar,datetime,json,pathlib,unittest
from review_quality import analyze,buckets,eligible,open_windows,rated_low


def month(i):
    y,m=divmod(i,12);return int(calendar.timegm((2020+y,m+1,1,0,0,0)))


def history(months,events=()):
    """Monthly histogram from (up, down) pairs starting Jan 2020."""
    rows=[dict(date=month(i),recommendations_up=u,recommendations_down=d) for i,(u,d) in enumerate(months)]
    return dict(success=1,results=dict(rollup_type='month',rollups=rows,recent=[]),past_events=[dict(type=0,start_date=s,end_date=e) for s,e in events])


def review(lang='english',text='fun game',playtime=600):
    return dict(language=lang,review=text,author=dict(playtime_at_review=playtime,num_reviews=5),received_for_free=False)


def players(n,**kw):
    return [review(text=f'played it a lot, opinion number {i}',**kw) for i in range(n)]


def fetched(window_month,steam,headline,window=None,baseline=None):
    return dict(headline=headline,windows={month(window_month):dict(steam=steam,reviews=window or players(40),baseline=baseline or players(40))})


def topics(texts):
    """Stand-in for the embedding classifier: anything mentioning the store deal is off-game."""
    return ['exclusive' in t for t in texts]


QUIET=[(80,20)]*24


class Verdicts(unittest.TestCase):
    def test_bomb_that_recovers_is_removed_from_the_headline_population(self):
        payload=history(QUIET+[(60,900)]+QUIET)
        result=analyze(payload,68,fetched(24,(50,850),(3870,1810)))
        [w]=result['bomb_windows']
        self.assertEqual(w['verdict'],'bomb')
        self.assertIn('recovered',w['reason'])
        self.assertAlmostEqual(result['clean_score'],100*(3870-50)/(3870-50+1810-850))
        self.assertEqual((w['up'],w['down'],w['steam_up'],w['steam_down']),(60,900,50,850))

    def test_headline_in_another_population_never_adjusts(self):
        # Apex Legends: Steam purchases alone gave 1.6k reviews at 75% against a 1.08M, 67% headline.
        payload=history(QUIET+[(60,900)]+QUIET)
        result=analyze(payload,67,fetched(24,(2,70),(1186,404)))
        self.assertEqual(result['clean_score'],67)
        self.assertTrue(result['headline_mismatch'])
        self.assertFalse(result['bomb_windows'])

    def test_lasting_decline_is_never_adjusted(self):
        # Neos VR: ~80% before, single digits during, ~20% for years after.
        payload=history(QUIET+[(10,250)]+[(4,16)]*24)
        result=analyze(payload,57,fetched(24,(10,250),(2000,1500)))
        self.assertEqual(result['bomb_windows'],[])
        self.assertEqual(result['clean_score'],57)
        [w]=result['review_events']
        self.assertEqual(w['verdict'],'decline')

    def test_partial_recovery_that_settles_lower_is_a_decline(self):
        # Onward: recovered most of the dip but settled 14 points below.
        payload=history([(83,17)]*24+[(30,70)]*2+[(69,31)]*24)
        result=analyze(payload,69,fetched(24,(60,140),(5900,2700)))
        self.assertEqual(result['clean_score'],69)
        self.assertTrue(all(w['verdict']=='decline' for w in result['review_events']))

    def test_ending_better_than_before_counts_as_recovered(self):
        payload=history([(56,44)]*24+[(10,300)]+[(77,23)]*24)
        result=analyze(payload,62,fetched(24,(10,300),(5000,3000)))
        self.assertEqual(len(result['bomb_windows']),1)

    def test_counter_reviews_do_not_hide_a_bomb(self):
        # Borderlands 2, April 2019: 46% negative against a 10% baseline.
        payload=history([(90,10)]*24+[(540,460)]+[(90,10)]*24)
        result=analyze(payload,67,fetched(24,(500,400),(4000,2000)))
        self.assertEqual(len(result['bomb_windows']),1)

    def test_steam_labelled_window_is_reported_not_subtracted_again(self):
        payload=history(QUIET+[(60,900)]+QUIET,events=[(month(24)+3*86400,month(24)+12*86400)])
        result=analyze(payload,75,fetched(24,(5,10),(3870,1300)))
        self.assertEqual(result['bomb_windows'],[])
        self.assertEqual(result['clean_score'],75)
        self.assertEqual(result['review_events'][0]['verdict'],'steam_flagged')
        self.assertEqual(len(result['steam_events']),1)
        # Blind to the label, the shape alone still calls it a bomb.
        self.assertEqual(analyze(payload,75,fetched(24,(5,10),(3870,1300)),steam_labels=False)['bomb_windows'][0]['verdict'],'bomb')

    def test_outsider_wave_is_a_bomb_even_while_it_lingers(self):
        payload=history(QUIET+[(10,400)]+[(50,50)]*24)
        before=players(40);during=players(30,lang='turkish')+players(10)
        result=analyze(payload,67,fetched(24,(10,400),(3000,1500),window=during,baseline=before))
        [w]=result['bomb_windows']
        self.assertIn('turkish',w['reason'])

    def test_open_window_with_weak_evidence_is_shown_but_not_adjusted(self):
        payload=history(QUIET+[(60,900)])
        newcomers=players(40,playtime=30)  # one family of evidence only: who is reviewing
        result=analyze(payload,64,fetched(24,(50,850),(3000,1700),window=newcomers),topics=topics)
        [w]=result['bomb_windows']
        self.assertEqual((w['verdict'],w['adjusted']),('unresolved',False))
        self.assertEqual(result['clean_score'],64)
        self.assertFalse(eligible(dict(review_count=4700,review_positive_pct=51,clean_score=result['clean_score'],bomb_windows=result['bomb_windows'])))
        self.assertEqual(open_windows(result),result['bomb_windows'])

    def test_a_bad_launch_is_not_shown_as_a_possible_bomb(self):
        # A new game with almost no history: no before, so no break to judge and no banner.
        payload=history([(5,1),(60,900),(10,10)])
        result=analyze(payload,7,fetched(1,(50,850),(70,911)),topics=topics)
        [w]=result['review_events']
        self.assertEqual(w['verdict'],'unresolved')
        self.assertIn('Too few reviews',w['reason'])
        self.assertEqual(result['bomb_windows'],[])

    def test_open_bomb_with_strong_evidence_is_adjusted_now(self):
        payload=history(QUIET+[(60,900)])
        bombers=[review(text=f'store exclusive deal, boycott {i}',playtime=30) for i in range(40)]
        result=analyze(payload,64,fetched(24,(50,850),(3000,1700),window=bombers),topics=topics)
        [w]=result['bomb_windows']
        self.assertEqual((w['verdict'],w['adjusted']),('active_bomb',True))
        self.assertIn('outside the game',w['reason'])
        self.assertAlmostEqual(result['clean_score'],100*2950/(2950+850))

    def test_open_decline_by_the_games_own_players_is_called_a_decline(self):
        # Neos VR judged at the time: established players writing about the split, not off-game topics.
        payload=history(QUIET+[(10,250)])
        result=analyze(payload,57,fetched(24,(10,250),(2000,1500),window=players(40,playtime=9000),baseline=players(40,playtime=9000)),topics=topics)
        self.assertEqual(result['bomb_windows'],[])
        self.assertEqual(result['review_events'][0]['verdict'],'decline')

    def test_launch_spikes_and_sales_are_not_candidates(self):
        payload=history([(4000,1000)]+QUIET[:11]+[(1600,400)]+QUIET[:11])
        self.assertEqual(analyze(payload,80)['review_events'],[])

    def test_positive_spikes_are_reported_not_bombs(self):
        result=analyze(json.loads((pathlib.Path(__file__).parent/'fixtures/big-walk-20261113.json').read_text()),91)
        self.assertFalse(any(w['start']=='2026-11-09' and w['adjusted'] for w in result['bomb_windows']))
        self.assertTrue(all(w['polarity']=='positive' for w in result['positive_windows']))

    def test_bomb_verdict_without_steam_counts_does_not_rescue(self):
        payload=history(QUIET+[(60,900)]+QUIET)
        self.assertEqual(analyze(payload,51)['clean_score'],51)
        self.assertEqual(analyze(dict(success=1,results={}),42)['clean_score'],42)


class Buckets(unittest.TestCase):
    def test_months_have_actual_duration(self):
        data=dict(success=1,results=dict(rollup_type='month',recent=[],rollups=[dict(date=1706745600,recommendations_up=100,recommendations_down=29)]))
        [b]=buckets(data)
        self.assertEqual((b['end']-b['start'])/86400,29)

    def test_overlap_is_counted_once(self):
        days=[dict(date=i*86400,recommendations_up=10,recommendations_down=1) for i in range(3,7)]
        week=dict(date=0,recommendations_up=70,recommendations_down=7)
        bs=buckets(dict(success=1,results=dict(recent=days,rollups=[week],rollup_type='week')))
        self.assertEqual((sum(b['up'] for b in bs),sum(b['down'] for b in bs)),(70,7))


class Eligibility(unittest.TestCase):
    def test_unrated_stays(self):
        for count in [0,1,9]:
            self.assertTrue(eligible(dict(review_count=count,review_positive_pct=0,clean_score=0)))
            self.assertFalse(rated_low(0,count))

    def test_score_threshold(self):
        self.assertTrue(eligible(dict(review_count=10,review_positive_pct=70)))
        self.assertFalse(eligible(dict(review_count=10,review_positive_pct=69)))
        self.assertTrue(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[dict(up=1,down=100)])))
        # A bomb drowned in counter-reviews still rescues.
        self.assertTrue(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[dict(up=540,down=460,verdict='bomb',adjusted=True)])))
        # Rows from before v3 carry no flag and only ever stored negative-majority windows.
        self.assertFalse(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[dict(up=540,down=460)])))
        self.assertFalse(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[])))
        self.assertFalse(eligible(dict(review_count=100,review_positive_pct=50,clean_score=91,bomb_windows=[dict(up=1,down=100,adjusted=False)])))


if __name__=='__main__':unittest.main()
