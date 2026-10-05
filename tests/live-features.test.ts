import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {candidateChanges,orderStates,parseProgressHistory,readSharedPanel,recordProgressHistory,remainingSections,sharedPanelLink} from '../lib/live-features';
import {emptyBrazilProgress} from '../services/tse/progress';
import {emptyPreferences} from '../lib/preferences';
import {emptySnapshot,getMunicipalLeaders,getMunicipalProgress} from '../services/tse/service';
import {parseMunicipalProgress} from '../services/tse/municipal-progress';
import {verifyOfficialJws} from '../services/tse/client';
import type {Candidate} from '../types/election';
import {BRAZIL_STATES} from '../lib/brazil-states';
test('ordenação e filtro de estados preservam valores ausentes e não escondem os indisponíveis',()=>{
  const rows=[{name:'Acre',status:'finished',percentage:100,sections:100,totalSections:100},{name:'Bahia',status:'counting',percentage:50,sections:500,totalSections:1000},{name:'Ceará',status:'counting',percentage:80,sections:800,totalSections:1000},{name:'Amapá',status:'unavailable',percentage:null,sections:null,totalSections:null}];
  assert.deepEqual(orderStates(rows,'remaining',false).map(s=>s.name),['Bahia','Ceará','Acre','Amapá']);
  assert.deepEqual(orderStates(rows,'least',true).map(s=>s.name),['Bahia','Ceará','Amapá']);
  assert.deepEqual(orderStates(rows,'most',false).map(s=>s.name),['Acre','Ceará','Bahia','Amapá']);
  assert.equal(rows[0].name,'Acre');assert.equal(remainingSections(rows[0]),0);assert.equal(remainingSections(rows[3]),null);
});
test('link transporta UF, candidatos e cidades, incluindo painel vazio, sem dados de resultados',()=>{
  const preferences={version:1 as const,candidates:[{office:'federalDeputy' as const,candidateId:'123'}],regional:[{office:'stateDeputy' as const,candidateId:'456',municipalityCodes:['80594','81582']}]};
  const link=sharedPanelLink('https://resultado-eleicoes-2026.vercel.app/','sc',preferences);
  assert.equal(new URL(link).search,'?uf=sc');assert.deepEqual(readSharedPanel(link),{uf:'sc',preferences});
  assert.deepEqual(readSharedPanel(sharedPanelLink('https://example.com','sp',emptyPreferences())),{uf:'sp',preferences:emptyPreferences()});
  assert.equal(readSharedPanel(link.replace('uf=sc','uf=sp')),null);
});
test('link rejeita payloads inválidos, UF incorreta, versão desconhecida e excesso de consultas',()=>{
  const url=(payload:unknown)=>`https://example.com/?uf=sc#painel=${btoa(JSON.stringify(payload)).replace(/=/g,'')}`;
  assert.equal(readSharedPanel('https://example.com/?uf=sc#painel=<>'),null);
  assert.equal(readSharedPanel(url({v:2,uf:'sc',preferences:emptyPreferences()})),null);
  assert.equal(readSharedPanel(url({v:1,uf:'zz',preferences:emptyPreferences()})),null);
  assert.equal(readSharedPanel(url({v:1,uf:'sc',preferences:{...emptyPreferences(),candidates:[{candidateId:'<script>',office:'president'}]}})),null);
  const regional=[{office:'president' as const,candidateId:'1',municipalityCodes:Array.from({length:30},(_,i)=>String(10000+i))},{office:'governor' as const,candidateId:'2',municipalityCodes:['10000']}];
  assert.equal(readSharedPanel(url({v:1,uf:'sc',preferences:{...emptyPreferences(),regional}})),null);
  assert.throws(()=>sharedPanelLink('https://example.com','sc',{...emptyPreferences(),regional}));
});
test('avisos exigem duas gerações válidas, melhora de posição ou confirmação oficial, sem repetir nem antecipar eleitos',()=>{
  const old=emptySnapshot('sc');old.source.verifiedSignatures=true;
  const c:Candidate={id:'123',name:'Candidato',fullName:'Candidato',number:'22',party:'PL',office:'stateDeputy',votes:100,percentage:10,rank:21,officialStatus:null,officialElected:false,photoUrl:null,destination:null};
  old.stateDeputy=[c];old.offices.stateDeputy={...old.offices.stateDeputy,generation:'1',updatedAt:'2026-10-04T21:00:00.000Z',status:'counting'};
  const current=structuredClone(old);current.offices.stateDeputy.generation='2';current.offices.stateDeputy.updatedAt='2026-10-04T21:01:00.000Z';current.stateDeputy[0].rank=20;
  const choices=[{candidateId:'123',office:'stateDeputy' as const}];
  assert.deepEqual(candidateChanges(old,current,choices).map(e=>e.kind),['rank']);
  current.stateDeputy[0].officialElected=true;assert.deepEqual(candidateChanges(old,current,[...choices,...choices]).map(e=>e.kind),['rank','elected']);
  assert.equal(candidateChanges(null,current,choices).length,0);assert.equal(candidateChanges(current,current,choices).length,0);
  current.stale=true;assert.equal(candidateChanges(old,current,choices).length,2);current.stale=false;current.offices.stateDeputy.stale=true;assert.equal(candidateChanges(old,current,choices).length,0);current.offices.stateDeputy.stale=false;
  current.state.uf='sp';assert.equal(candidateChanges(old,current,choices).length,0);current.state.uf='sc';
  current.offices.stateDeputy.updatedAt='2026-10-04T20:59:00.000Z';assert.equal(candidateChanges(old,current,choices).length,0);
});
test('histórico de progresso registra mudanças oficiais, rejeita regressão/duplicação/falha e limita a 240 por UF',()=>{
  const data=emptyBrazilProgress();data.stale=false;data.updatedAt='2026-10-04T21:00:00.000Z';const sc=data.states.find(s=>s.uf==='SC')!;Object.assign(sc,{status:'counting',sections:50,totalSections:100,percentage:50});
  const first=recordProgressHistory({},data);assert.equal(first.SC.length,1);assert.equal(recordProgressHistory(first,data),first);
  data.updatedAt='2026-10-04T21:01:00.000Z';assert.equal(recordProgressHistory(first,data),first);
  sc.sections=70;sc.percentage=70;const next=recordProgressHistory(first,data);assert.equal(next.SC.length,2);
  data.updatedAt='2026-10-04T20:59:00.000Z';assert.equal(recordProgressHistory(next,data),next);
  data.updatedAt='2026-10-04T21:02:00.000Z';data.stale=true;assert.equal(recordProgressHistory(next,data),next);
  data.stale=false;sc.sections=101;assert.equal(recordProgressHistory(next,data),next);
  const many=Array.from({length:300},(_,i)=>({at:new Date(Date.UTC(2026,9,4,0,i)).toISOString(),sections:i,totalSections:1000,percentage:i/10}));
  assert.equal(parseProgressHistory({SC:many,invalid:many}).SC.length,240);assert.equal(parseProgressHistory({SC:many,invalid:many}).invalid,undefined);
});
test('EA15 valida eleição, UF, municípios do catálogo, inteiros e progresso; cidades ausentes permanecem desconhecidas',()=>{
  const municipalities=[{code:'80594',name:'Caibi',ibgeCode:'4203105'},{code:'81582',name:'Cunhataí'}];
  const raw={ele:'6257',t:'1',f:'o',dg:'04/10/2026',hg:'18:00:00',abr:[{tpabr:'uf',cdabr:'sc',and:'p',s:{ts:'100',st:'50',pst:'50'}},{tpabr:'mun',cdabr:'80594',and:'p',s:{ts:'10',st:'5',pst:'50'}}]};
  const parsed=parseMunicipalProgress(raw,'6257','sc',municipalities,'official');assert.equal(parsed.municipalities[0].sections,5);assert.equal(parsed.municipalities[0].ibgeCode,'4203105');assert.equal(parsed.municipalities[1].sections,null);
  assert.throws(()=>parseMunicipalProgress(raw,'999','sc',municipalities,''));assert.throws(()=>parseMunicipalProgress(raw,'6257','sp',municipalities,''));
  assert.throws(()=>parseMunicipalProgress({...raw,abr:[...raw.abr,raw.abr[1]]},'6257','sc',municipalities,''));
  assert.throws(()=>parseMunicipalProgress({...raw,abr:[raw.abr[0],{...raw.abr[1],cdabr:'99999'}]},'6257','sc',municipalities,''));
  assert.throws(()=>parseMunicipalProgress({...raw,abr:[raw.abr[0],{...raw.abr[1],s:{ts:'10',st:'11',pst:'110'}}]},'6257','sc',municipalities,''));
});
test('fontes municipais assinadas entregam progresso completo e somente lideranças das cidades solicitadas',async()=>{
  const official=verifyOfficialJws(readFileSync('tests/fixtures/sc-e006257-ab.jws','utf8'));assert.ok(official);
  const originalFetch=globalThis.fetch,originalNow=Date.now;
  globalThis.fetch=async input=>{const file=join('tests/fixtures',new URL(String(input)).pathname.split('/').at(-1)!);return new Response(existsSync(file)?readFileSync(file,'utf8'):'',{status:existsSync(file)?200:404});};
  try{
    const progress=await getMunicipalProgress('sc');assert.equal(progress.verifiedSignatures,true);assert.equal(progress.municipalities.length,295);assert.ok(progress.municipalities.every(m=>/^42\d{5}$/.test(m.ibgeCode||'')));
    const result=await getMunicipalLeaders('sc',['80594','80594']);assert.equal(result.municipalities.length,1);assert.equal(result.municipalities[0].verifiedSignatures,true);assert.ok(result.municipalities[0].candidates.length<=2);
    await assert.rejects(()=>getMunicipalLeaders('sc',['99999']));await assert.rejects(()=>getMunicipalLeaders('sc',[]));
    const before=originalNow();Date.now=()=>before+31000;globalThis.fetch=async()=>{throw new Error('offline');};
    const stale=await getMunicipalProgress('sc'),staleVotes=await getMunicipalLeaders('sc',['80594']);assert.equal(stale.stale,true);assert.deepEqual(stale.municipalities,progress.municipalities);assert.deepEqual(staleVotes.municipalities[0].candidates,result.municipalities[0].candidates);
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
test('malhas das 27 UFs usam somente códigos IBGE da UF e polígonos distintos',()=>{
  for(const state of BRAZIL_STATES){const uf=state.uf.toLowerCase(),geometry=JSON.parse(readFileSync(`public/maps/${uf}-municipal.json`,'utf8'));assert.equal(geometry.uf,uf);assert.ok(geometry.shapes.length>0);assert.equal(new Set(geometry.shapes.map((s:{id:string})=>s.id)).size,geometry.shapes.length);assert.ok(geometry.shapes.every((s:{id:string;d:string})=>s.id.startsWith(state.id)&&s.d.startsWith('M')&&s.d.endsWith('Z')));}
});
