"""Build compact, public 2022 first-round data from the TSE's official ZIP.

Only UF members and BR (president) are downloaded using HTTP ranges. BRASIL,
which duplicates the regional files, is deliberately excluded. Raw CSV files
stay in the supplied work directory, outside the published application.
"""
import argparse, concurrent.futures, csv, gzip, hashlib, json, struct
import urllib.request, zlib
from pathlib import Path

URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip'
OFFICES = {'1':'president', '3':'governor', '5':'senator', '6':'federalDeputy', '7':'stateDeputy', '8':'stateDeputy'}
STATES = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split()

def get_range(start, end, etag=None):
    headers={'Range':f'bytes={start}-{end}'}
    if etag: headers['If-Match']=etag
    response=urllib.request.urlopen(urllib.request.Request(URL,headers=headers),timeout=90)
    if response.status!=206 or response.headers.get('Content-Range','').split('/')[0]!=f'bytes {start}-{end}':
        response.close(); raise ValueError('The CDN did not return the requested ZIP range')
    return response

def index():
    with urllib.request.urlopen(urllib.request.Request(URL,method='HEAD'),timeout=30) as response:
        size=int(response.headers['Content-Length']); etag=response.headers['ETag']; modified=response.headers['Last-Modified']
    with get_range(size-65536,size-1,etag) as response: tail=response.read()
    pos=tail.rfind(b'PK\x05\x06'); end=struct.unpack_from('<4s4H2IH',tail,pos)
    start=end[6]-(size-65536); entries={}; pos=start
    for _ in range(end[4]):
        fields=struct.unpack_from('<4s6H3I5H2I',tail,pos)
        if fields[0]!=b'PK\x01\x02': raise ValueError('Invalid ZIP directory')
        name=tail[pos+46:pos+46+fields[10]].decode('utf8')
        if name.endswith('.csv') and not name.endswith('_BRASIL.csv'):
            if fields[4]!=8 or fields[8]==0xffffffff: raise ValueError('Unsupported member')
            entries[name.rsplit('_',1)[-1][:-4]]={'name':name,'compressed':fields[8],'size':fields[9],'offset':fields[16],'crc':fields[7]}
        pos+=46+fields[10]+fields[11]+fields[12]
    return entries,etag,modified

def extract(uf,entry,work,etag):
    csv_path=work/f'2022-{uf}.csv'; compressed=work/f'2022-{uf}.deflate'
    with get_range(entry['offset'],entry['offset']+29,etag) as response: header=response.read()
    fields=struct.unpack('<4s5H3I2H',header)
    if fields[0]!=b'PK\x03\x04': raise ValueError('Invalid member header')
    start=entry['offset']+30+fields[-2]+fields[-1]
    if not compressed.exists() or compressed.stat().st_size!=entry['compressed']:
        with get_range(start,start+entry['compressed']-1,etag) as response, compressed.open('wb') as output:
            while block:=response.read(1024*1024): output.write(block)
    decompressor=zlib.decompressobj(-15); crc=0; size=0; digest=hashlib.sha256()
    with compressed.open('rb') as source,csv_path.open('wb') as output:
        while block:=source.read(65536):
            raw=decompressor.decompress(block); output.write(raw); crc=zlib.crc32(raw,crc); size+=len(raw); digest.update(raw)
        raw=decompressor.flush(); output.write(raw); crc=zlib.crc32(raw,crc); size+=len(raw); digest.update(raw)
    if size!=entry['size'] or crc!=entry['crc']: raise ValueError('ZIP member failed CRC or length validation')
    return csv_path,digest.hexdigest()

def parse_csv(path,expected):
    by_state={}; accepted=0
    with path.open(encoding='latin-1',newline='') as source:
        reader=csv.DictReader(source,delimiter=';')
        required=['ANO_ELEICAO','NR_TURNO','CD_TIPO_ELEICAO','CD_ELEICAO','DT_ELEICAO','SG_UF','CD_CARGO','SQ_CANDIDATO','NM_CANDIDATO','NM_URNA_CANDIDATO','NR_CANDIDATO','SG_PARTIDO','CD_MUNICIPIO','NM_MUNICIPIO','QT_VOTOS_NOMINAIS_VALIDOS']
        if not all(key in (reader.fieldnames or []) for key in required): raise ValueError('Official CSV layout changed')
        for row in reader:
            if row['ANO_ELEICAO']!='2022': raise ValueError('Wrong election year')
            if row['NR_TURNO']!='1' or row['CD_TIPO_ELEICAO']!='2' or row['DT_ELEICAO']!='02/10/2022': continue
            code=row['CD_CARGO']; office=OFFICES.get(code); uf=row['SG_UF'].lower()
            if not office or uf.upper() not in STATES: continue
            if (code=='1')!=(expected=='BR'): raise ValueError('Unexpected office in regional source')
            if expected!='BR' and uf.upper()!=expected: raise ValueError('Wrong UF in regional source')
            if row['CD_ELEICAO']!=('544' if code=='1' else '546'): raise ValueError('Wrong first-round election')
            votes=int(row['QT_VOTOS_NOMINAIS_VALIDOS']); city=str(int(row['CD_MUNICIPIO'])).zfill(5); candidate_id=row['SQ_CANDIDATO']
            if votes<0 or len(city)!=5 or not candidate_id.isdigit(): raise ValueError('Invalid vote or identity')
            state=by_state.setdefault(uf,{'cities':{},'candidates':{}})
            state['cities'][city]=row['NM_MUNICIPIO']
            candidate=state['candidates'].setdefault(candidate_id,{'id':candidate_id,'name':row['NM_URNA_CANDIDATO'],'fullName':row['NM_CANDIDATO'],'number':row['NR_CANDIDATO'],'party':row['SG_PARTIDO'],'office':office,'votes':{}})
            if candidate['fullName']!=row['NM_CANDIDATO'] or candidate['office']!=office: raise ValueError('Inconsistent candidate identity')
            candidate['votes'][city]=candidate['votes'].get(city,0)+votes; accepted+=1
    return by_state,accepted

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--work',type=Path,required=True); parser.add_argument('--output',type=Path,default=Path('data/elections-2022')); parser.add_argument('--states',nargs='*',default=STATES); args=parser.parse_args()
    args.work.mkdir(parents=True,exist_ok=True); args.output.mkdir(parents=True,exist_ok=True)
    entries,etag,modified=index(); selected=args.states
    if any(uf not in STATES for uf in selected): raise ValueError('Unknown state')
    def load(uf):
        path,sha=extract(uf,entries[uf],args.work,etag); states,count=parse_csv(path,uf)
        print(json.dumps({'uf':uf,'rows':count,'candidates':sum(len(state['candidates']) for state in states.values())}),flush=True)
        path.unlink()
        return states,{'member':entries[uf]['name'],'sha256':sha,'zipCrc32':entries[uf]['crc'],'rows':count}
    presidential,president_source=load('BR')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for uf,(regional,source) in zip(selected,pool.map(load,selected)):
            state=regional[uf.lower()]; president=presidential[uf.lower()]
            state['cities'].update(president['cities']); state['candidates'].update(president['candidates'])
            result={'year':2022,'round':1,'uf':uf.lower(),'voteField':'QT_VOTOS_NOMINAIS_VALIDOS','source':URL,'zipEtag':etag,'sourceModified':modified,'members':[source,president_source],'cities':state['cities'],'candidates':list(state['candidates'].values())}
            encoded=json.dumps(result,ensure_ascii=False,separators=(',',':')).encode('utf8')
            (args.output/f'{uf.lower()}.json.gz').write_bytes(gzip.compress(encoded,mtime=0))
            print(f'Wrote {uf}: {len(encoded)} bytes before gzip',flush=True)

if __name__=='__main__': main()
