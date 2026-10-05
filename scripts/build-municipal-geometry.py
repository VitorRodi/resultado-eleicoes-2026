"""Generate simplified municipal SVG paths from the official IBGE API."""
import json,gzip,math,urllib.request,re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
repo=Path(__file__).resolve().parent.parent
states=re.findall(r"id:'(\d+)',uf:'([A-Z]+)'",(repo/'lib/brazil-states.ts').read_text(encoding='utf-8'))
out=repo/'public/maps';out.mkdir(exist_ok=True,parents=True)
def build(state):
    code,uf=state;target=out/f'{uf.lower()}-municipal.json'
    if target.exists():return uf,'cached'
    url=f'https://servicodados.ibge.gov.br/api/v3/malhas/estados/{code}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima'
    with urllib.request.urlopen(url,timeout=45) as response:
        data=response.read();data=gzip.decompress(data) if data[:2]==b'\x1f\x8b' else data;geo=json.loads(data)
    features=geo['features']
    def polygons(f):
        g=f['geometry'];return [g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    coordinates=[p for f in features for poly in polygons(f) for ring in poly for p in ring]
    midlat=(min(p[1] for p in coordinates)+max(p[1] for p in coordinates))/2
    horizontal=math.cos(math.radians(midlat))
    xmin=min(p[0]*horizontal for p in coordinates);xmax=max(p[0]*horizontal for p in coordinates)
    ymin=min(p[1] for p in coordinates);ymax=max(p[1] for p in coordinates)
    scale=min(520/(xmax-xmin),390/(ymax-ymin));left=20+(520-(xmax-xmin)*scale)/2;top=20+(390-(ymax-ymin)*scale)/2
    def point(p):return f'{left+(p[0]*horizontal-xmin)*scale:.2f},{top+(ymax-p[1])*scale:.2f}'
    shapes=[]
    for f in features:
        identifier=str(f['properties']['codarea'])
        if len(identifier)!=7 or not identifier.startswith(code):raise ValueError(f'Geometry code outside UF: {identifier}')
        d=''.join('M'+'L'.join(point(p) for p in ring)+'Z' for poly in polygons(f) for ring in poly if len(ring)>=3)
        shapes.append({'id':identifier,'d':d})
    if len({s['id'] for s in shapes})!=len(shapes):raise ValueError('Duplicate geometry')
    target.write_text(json.dumps({'uf':uf.lower(),'viewBox':'0 0 560 430','source':url,'shapes':shapes},separators=(',',':')),encoding='utf-8')
    return uf,len(shapes)
with ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(build,states):print(*result,flush=True)
