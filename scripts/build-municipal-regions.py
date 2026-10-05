"""Refresh the official IBGE immediate-region mapping used by reports."""
import gzip,hashlib,json,urllib.request
from pathlib import Path
URL='https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
with urllib.request.urlopen(URL,timeout=60) as response: raw=response.read()
if raw.startswith(b'\x1f\x8b'): raw=gzip.decompress(raw)
rows={}
for municipality in json.loads(raw):
    region=municipality.get('regiao-imediata')
    if not region: raise ValueError('Municipality without an official immediate region')
    uf=region['regiao-intermediaria']['UF']['sigla'].lower()
    rows[str(municipality['id'])]={'uf':uf,'name':municipality['nome'],'regionId':str(region['id']),'regionName':region['nome']}
if len(rows)<5500 or rows.get('4203105',{}).get('uf')!='sc': raise ValueError('Incomplete or invalid catalog')
payload={'source':URL,'sha256':hashlib.sha256(raw).hexdigest(),'definition':'Regiões geográficas imediatas do IBGE','municipalities':rows}
Path('data/municipal-regions.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'{len(rows)} municipalities saved')
