import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {verifyOfficialJws} from '../services/tse/client';
import {parseBrazilProgress} from '../services/tse/progress';
import {defaultWatchlist,REGIONAL_CITIES} from '../lib/default-watchlist';
import {applyRegionalSelections,municipalRequests} from '../lib/preferences';
import {emptySnapshot} from '../services/tse/service';
import {normalizeResult} from '../services/tse/normalize';
import {parseResult} from '../services/tse/parser';
import {municipalitySchema} from '../services/tse/types';
import type {RegionalSelection} from '../types/election';
const fixture=(name:string)=>verifyOfficialJws(readFileSync(join(process.cwd(),'tests/fixtures',name),'utf8'));
const progress=()=>fixture('br-e006257-ab.jws') as {ele:string;f:string;abr:{tpabr:string;cdabr:string;and:string;s:{st:string;ts:string;pst:string;pstn?:string}}[]};
const source='https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-e006257-ab.jws';
test('acompanhamento oficial produz 27 UFs sem Brasil agregado ou exterior',()=>{
  const raw=progress(),result=parseBrazilProgress(raw,'6257',source);
  assert.equal(result.states.length,27);assert.equal(new Set(result.states.map(s=>s.uf)).size,27);
  assert.ok(result.states.every(s=>!['BR','ZZ'].includes(s.uf)));
  const sc=raw.abr.find(s=>s.cdabr==='sc')!;
  assert.equal(result.states.find(s=>s.uf==='SC')!.percentage,Number((sc.s.pstn??sc.s.pst).replace(',','.')));
  assert.equal(result.stale,false);
});
test('acompanhamento rejeita simulado, eleição errada, duplicação e percentual inválido',()=>{
  const raw=progress();assert.throws(()=>parseBrazilProgress({...raw,f:'s'},'6257',source));assert.throws(()=>parseBrazilProgress(raw,'6259',source));
  assert.throws(()=>parseBrazilProgress({...raw,abr:[...raw.abr,raw.abr[0]]},'6257',source));
  const invalid=structuredClone(raw);invalid.abr[0].s.pstn='101';assert.throws(()=>parseBrazilProgress(invalid,'6257',source));
});
test('UF sem dado permanece indisponível e não vira zero por cento',()=>{
  const raw=progress();raw.abr=raw.abr.filter(s=>s.cdabr!=='sc');const result=parseBrazilProgress(raw,'6257',source);
  assert.equal(result.states.find(s=>s.uf==='SC')!.percentage,null);assert.equal(result.states.find(s=>s.uf==='SC')!.status,'unavailable');
});
test('seleção múltipla aplica cidades sem duplicar requisições por cargo',()=>{
  const selections:RegionalSelection[]=[{office:'stateDeputy',candidateId:'1',municipalityCodes:['80594','80594']},{office:'stateDeputy',candidateId:'2',municipalityCodes:['80594']},{office:'federalDeputy',candidateId:'3',municipalityCodes:['80594']}];
  const result=applyRegionalSelections([],selections);assert.equal(result.length,3);assert.equal(result[0].municipalityCodes.length,1);assert.equal(municipalRequests(result).length,2);
  const edited=applyRegionalSelections(result,[{...selections[0],municipalityCodes:['80918']}]);assert.equal(edited.length,3);assert.deepEqual(edited[0].municipalityCodes,['80918']);
  const appended=applyRegionalSelections(result,[{...selections[0],municipalityCodes:['80918']}],true);assert.deepEqual(appended[0].municipalityCodes,['80594','80918']);assert.deepEqual(appended[1].municipalityCodes,['80594']);
});
test('lote acima dos limites é rejeitado sem modificar escolhas anteriores',()=>{
  const current:RegionalSelection[]=[{office:'stateDeputy',candidateId:'1',municipalityCodes:['80594']}];const saved=structuredClone(current);
  assert.throws(()=>applyRegionalSelections(current,Array.from({length:51},(_,i)=>({office:'stateDeputy',candidateId:String(i+2),municipalityCodes:['80594']}))));
  assert.throws(()=>applyRegionalSelections(current,[{office:'federalDeputy',candidateId:'2',municipalityCodes:Array.from({length:30},(_,i)=>String(81000+i))}]));
  assert.deepEqual(current,saved);
});
test('padrão solicitado resolve três registros e nove cidades no catálogo oficial',()=>{
  const snapshot=emptySnapshot();
  for(const [office,code] of [['federalDeputy','0006'],['stateDeputy','0007']] as const)snapshot[office]=normalizeResult(parseResult(fixture(`sc-c${code}-e006259-u.jws`),office,'6259'),office,'https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc').candidates;
  snapshot.municipalities=municipalitySchema.parse(fixture('mun-e006259-cm.jws')).abr.find(a=>a.cd==='sc')!.mu.map(m=>({code:String(m.cd).padStart(5,'0'),name:m.nm}));
  const result=defaultWatchlist(snapshot)!;assert.ok(result);assert.equal(result.candidates.length,3);assert.equal(result.regional.length,3);
  assert.equal(result.candidates[2].candidateId,'240002539970');assert.equal(municipalRequests(result.regional).length,18);
  assert.ok(result.regional.every(s=>s.municipalityCodes.length===9&&new Set(s.municipalityCodes).size===9));
  assert.ok(REGIONAL_CITIES.includes('Cunhataí'));assert.ok(!REGIONAL_CITIES.includes('Bom Jesus do Oeste'));
  assert.equal(result.regional[0].municipalityCodes[0],'81620');
  snapshot.municipalities=[];assert.equal(defaultWatchlist(snapshot),null);
});
