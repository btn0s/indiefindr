"""Regress the Pro entitlement / undersized physical disk failure."""
import unittest
from unittest.mock import patch
from capacity import check_capacity
class Response:
 def __init__(self,size,free):self.body=(f'node_filesystem_size_bytes{{mountpoint="/data"}} {size}\nnode_filesystem_avail_bytes{{mountpoint="/data"}} {free}\n').encode()
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self):return self.body
class CapacityTest(unittest.TestCase):
 def check(self,gb,size,free):
  def api(path,data=None):
   if path.endswith('/config/disk'):return {'attributes':{'size_gb':gb}}
   if path.endswith('/api-keys'):return [{'name':'service_role','api_key':'test-only'}]
   if path.startswith('organizations/'):return {'plan':'pro'}
   if data:return [{'database_bytes':1024439987,'games':200896,'recs':2500000,'games_bytes':100000000,'recs_bytes':500000000}]
   return {'organization_id':'test'}
  with patch('capacity.urllib.request.urlopen',return_value=Response(size,free)):
   return check_capacity(api,200896,4893365)
 def test_small_physical_disk_blocks_even_when_pro_entitlement_would_fit(self):
  self.assertFalse(self.check(2,2077073408,55136256)['publication_allowed'])
 def test_authorized_16gb_disk_has_headroom(self):
  self.assertTrue(self.check(16,16871018496,14849077248)['publication_allowed'])
 def test_full_16gb_disk_still_blocks(self):
  self.assertFalse(self.check(16,16871018496,55136256)['publication_allowed'])
if __name__=='__main__':unittest.main()
