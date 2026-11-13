import pathlib,runpy,tempfile,unittest
from nightly_release import build_snapshot
class ReleaseTest(unittest.TestCase):
 def test_checkout_downgrade_cannot_change_installed_release(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp);scripts=root/'scripts/relaunch';scripts.mkdir(parents=True)
   policy=pathlib.Path(__file__).with_name('selection.py').read_bytes();(scripts/'selection.py').write_bytes(policy)
   ((root/'data').resolve()).mkdir();(root/'scripts/recommender/.venv').mkdir(parents=True)
   for name in ['.env.steam','.env.relaunch-admin']:(root/name).write_text('')
   release=build_snapshot(root)
   (scripts/'selection.py').write_text('SLATE_SIZE=10\n')
   self.assertEqual(runpy.run_path(str(release/'scripts/relaunch/selection.py'))['SLATE_SIZE'],24)
   self.assertEqual((release/'data').resolve(),(root/'data').resolve())
   with self.assertRaises(AssertionError):build_snapshot(root)
if __name__=='__main__':unittest.main()
