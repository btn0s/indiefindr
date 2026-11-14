"""Companion apps: what ships alongside a main game rather than being one."""
from catalog import companions
rows=[
 dict(appid=1,title='Homicipher',developers=['Mafuyu'],is_free=False),
 dict(appid=2,title='Homicipher: Demo',developers=['Mafuyu'],is_free=True),
 dict(appid=3,title='The Planet Crafter',developers=['Miju'],is_free=False),
 dict(appid=4,title='The Planet Crafter: Prologue',developers=['Miju'],is_free=True),
 dict(appid=5,title='Homicipher Soundtrack',developers=['Mafuyu'],is_free=False,steam_type='music'),
 dict(appid=6,title='Cursed',developers=['Hex'],is_free=True),
 dict(appid=7,title='Cursed 2',developers=['Hex'],is_free=True),
 dict(appid=8,title='Homicipher Remix',developers=['Someone Else'],is_free=True),
 dict(appid=9,title='Homicipher 2',developers=['Mafuyu'],is_free=False),
]
assert companions(rows)=={2,4,5},companions(rows)
print('OK')
