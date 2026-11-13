"""Exercise the import boundary: legacy currencies must never become USD cents."""
import json,pathlib,subprocess,sys,tempfile,unittest
PREPARE=pathlib.Path(__file__).with_name('prepare.py')
class PricesTest(unittest.TestCase):
 def test_canonical_prices_replace_legacy_and_unavailable_becomes_null(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);data=root/'source/data';data.mkdir(parents=True)
   rows=[{'appid':i,'title':str(i),'price_overview':{'currency':'JPY','final':old}} for i,old in [(382110,170000),(2868840,109900),(1,780000)]]
   (data/'catalog.json').write_text(json.dumps({'rows':rows}));(data/'steam_tags.json').write_text(json.dumps({str(r['appid']):{'tags':[]} for r in rows}));(data/'steam_tag_names.json').write_text(json.dumps({'response':{'tags':[]}}))
   prices=root/'prices.json';prices.write_text(json.dumps({'382110':{'currency':'USD','final':2499},'2868840':{'currency':'USD','final':1999},'1':None}))
   subprocess.run([sys.executable,str(PREPARE),str(data.parent),'--catalog-only','--prices',str(prices),'--out',str(root/'import')],check=True,capture_output=True)
   result={r['appid']:r['price_cents'] for r in map(json.loads,(root/'import/games.jsonl').read_text().splitlines())}
   self.assertEqual(result,{382110:2499,2868840:1999,1:None})
if __name__=='__main__':unittest.main()
