"""Policy checks for ordered 24-target selection and candidate exhaustion."""
import unittest
from selection import SLATE_SIZE,select_targets
class SelectionTest(unittest.TestCase):
 def test_nested_caps_and_order(self):
  reviews=[50000]*8+[10000]*12+[9999]*30
  selected=select_targets(range(len(reviews)),reviews)
  self.assertEqual(len(selected),SLATE_SIZE)
  self.assertEqual(selected,list(range(5))+list(range(8,13))+list(range(20,34)))
  self.assertEqual(sum(reviews[i]>=50000 for i in selected),5)
  self.assertEqual(sum(reviews[i]>=10000 for i in selected),10)
 def test_exhaustion_and_duplicates(self):
  self.assertEqual(select_targets([0,0,1,2],{0:0,1:0,2:0}),[0,1,2])
  self.assertEqual(select_targets(range(20),[50000]*20),list(range(5)))
if __name__=='__main__':unittest.main()
