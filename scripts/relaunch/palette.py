"""Colour from the game: a small palette from each store header, for tinting its page (src/lib/palette.ts).

Median cut (Pillow) over a thumbnail of the header, read in OKLCH. Stored on games.palette as
{src, dominant, dark, accent}: dominant is the largest colour area, dark is its hue as a deep muted tone, and accent
is the most vivid colour holding a real share of the art (absent for near-monochrome art). `src` is the header it came
from, so a changed header is redone; a header that fails to download stores only `src` and the page keeps its neutrals.
Local and free: Steam's CDN and Pillow, no APIs. Runs nightly after media for new or changed headers.
"""
import argparse,concurrent.futures,io,json,math,pathlib,urllib.request
import requests
from PIL import Image

def oklch(rgb):
 r,g,b=[(c/255/12.92) if c/255<=.04045 else ((c/255+.055)/1.055)**2.4 for c in rgb]
 l,m,s=[(x)**(1/3) for x in (.4122214708*r+.5363325363*g+.0514459929*b,.2119034982*r+.6806995451*g+.1073969566*b,.0883024619*r+.2817188376*g+.6299787005*b)]
 L,a,bb=.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s
 return L,math.hypot(a,bb),math.degrees(math.atan2(bb,a))%360

def hex_from_oklch(L,C,h):
 # Out-of-gamut colours lose chroma until they fit.
 while True:
  a,b=C*math.cos(math.radians(h)),C*math.sin(math.radians(h))
  l,m,s=[x**3 for x in (L+.3963377774*a+.2158037573*b,L-.1055613458*a-.0638541728*b,L-.0894841775*a-1.2914855480*b)]
  rgb=(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s)
  if all(-1e-4<=c<=1+1e-4 for c in rgb) or C<1e-3:break
  C*=.9
 return '#'+''.join(f'{round(255*min(1,max(0,(12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055)))):02x}' for c in rgb)

def palette(image):
 img=Image.open(io.BytesIO(image)).convert('RGB');img.thumbnail((128,128))
 q=img.quantize(colors=8,method=Image.Quantize.MEDIANCUT);colors=q.getpalette();counts=q.getcolors()
 total=sum(n for n,_ in counts);clusters=[(n/total,tuple(colors[3*i:3*i+3])) for n,i in counts]
 dominant=max(clusters)[1];L,C,h=oklch(dominant)
 vivid=[(oklch(rgb)[1]*share**.3,rgb) for share,rgb in clusters if share>=.03 and oklch(rgb)[1]>=.06]
 return {'dominant':'#%02x%02x%02x'%dominant,'dark':hex_from_oklch(.27,min(C,.05),h),'accent':'#%02x%02x%02x'%max(vivid)[1] if vivid else None}

def entry(game):
 try:
  r=requests.get(game['header_image'],timeout=30)
  if r.status_code==404:return {'appid':game['appid'],'palette':{'src':game['header_image']}}
  r.raise_for_status()
  return {'appid':game['appid'],'palette':{'src':game['header_image'],**palette(r.content)}}
 except (requests.RequestException,OSError):return None  # Transient: retried next run.

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--limit',type=int,default=None,help='stop after this many games');a=p.parse_args()
 values=dict(l.split('=',1) for l in pathlib.Path('.env.relaunch-admin').read_text().splitlines() if '=' in l);ref=values['RELAUNCH_PROJECT_REF'];assert ref=='rqcqlpoxtdddjcylhopk'
 def query(sql):
  req=urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',headers={'Authorization':'Bearer '+values['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json','User-Agent':'indiefindr-pipeline'},data=json.dumps({'query':sql}).encode())
  with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
 done=last=0
 with concurrent.futures.ThreadPoolExecutor(32) as pool:
  while games:=query(f"select appid,header_image from public.games where appid>{last} and header_image is not null and palette->>'src' is distinct from header_image order by appid limit 500"):
   last=games[-1]['appid'];rows=[r for r in pool.map(entry,games) if r]
   if rows:query("update public.games g set palette=r.palette from jsonb_to_recordset('"+json.dumps(rows).replace("'","''")+"'::jsonb) as r(appid integer,palette jsonb) where g.appid=r.appid")
   done+=len(rows);print('palettes',done,flush=True)
   if a.limit and done>=a.limit:break
