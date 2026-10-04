import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { verifyOfficialJws, fetchOfficial } from '../services/tse/client';
import { parseResult, parseNationalPresident, parseNumber, officialTimestamp } from '../services/tse/parser';
import { normalizeResult } from '../services/tse/normalize';
import { rankCandidates, leadingPositions } from '../lib/ranking';
import { confirmedElected, electedByTse } from '../lib/elected';
import { findCandidate, track, sumRegional } from '../lib/tracking';
import { SnapshotCache } from '../lib/cache';
import { emptyPreferences, parsePreferences, municipalRequests, parseRegionalQuery, regionalRows } from '../lib/preferences';
import { emptySnapshot, getElectionSnapshot } from '../services/tse/service';
import type { Office, Candidate, MunicipalVote } from '../types/election';
const fixture = (name:string) => readFileSync(join(process.cwd(),'tests/fixtures',name),'utf8');
const official = (name:string) => verifyOfficialJws(fixture(name));
const rawFederal = () => parseResult(official('sc-c0006-e006259-u.jws'),'federalDeputy','6259');
const normalized = () => normalizeResult(rawFederal(),'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc');
// Synthetic vote scenarios are test-only mutations of the official EA20 structure.
function voting() {
  const result = structuredClone(rawFederal()); result.and='p'; result.s.st='1'; result.s.pstn='0.005771673';
  let n=1; for (const ag of result.carg[0].agr) for (const p of ag.par) for (const c of p.cand) { c.vap=String(n++); c.pvapn='0.1'; }
  return result;
}
const municipal = (name:string,votes:number|null,code:string=name): MunicipalVote => ({name,code,votes,percentage:votes == null ? null : 50,status:votes == null ? 'waiting':'counting',updatedAt:null});

test('assinatura oficial JWS é válida',() => assert.equal((official('ele-c.jws') as {f:string}).f,'o'));
test('assinatura adulterada é rejeitada',() => {
  const parts=fixture('ele-c.jws').trim().split('.'); parts[1]=Buffer.from('{"f":"o"}').toString('base64url');
  assert.throws(() => verifyOfficialJws(parts.join('.')),/inválida/);
});
test('JWS com chave desconhecida é rejeitado',() => {
  const parts=fixture('ele-c.jws').trim().split('.'); parts[0]=Buffer.from(JSON.stringify({alg:'none',kid:'fake'})).toString('base64url');
  assert.throws(() => verifyOfficialJws(parts.join('.')),/não oficial/);
});
test('parser valida os cinco cargos de SC',() => {
  for (const [code,office,election] of [[1,'president','6257'],[3,'governor','6259'],[5,'senator','6259'],[6,'federalDeputy','6259'],[7,'stateDeputy','6259']] as [number,Office,string][])
    assert.equal(parseResult(official(`sc-c${String(code).padStart(4,'0')}-e${election.padStart(6,'0')}-u.jws`),office,election).cdabr,'sc');
});
test('rejeita eleição incorreta',() => assert.throws(() => parseResult(rawFederal(),'federalDeputy','619')));
test('rejeita resultados de simulado',() => assert.throws(() => parseResult({...rawFederal(),f:'s'},'federalDeputy','6259')));
test('rejeita abrangência nacional no ranking de SC',() => assert.throws(() => parseResult({...rawFederal(),tpabr:'br',cdabr:'br'},'federalDeputy','6259')));
test('presidência nacional aceita apenas o arquivo BR da eleição federal',()=>{
  const raw=official('br-c0001-e006257-u.jws');assert.equal(parseNationalPresident(raw,'6257').cdabr,'br');
  assert.throws(()=>parseNationalPresident(official('sc-c0001-e006257-u.jws'),'6257'));
  assert.throws(()=>parseNationalPresident(raw,'6259'));
});
test('dois mais votados nacionais usam votos de todo o Brasil e aguardam antes da contagem',()=>{
  const raw=parseNationalPresident(official('br-c0001-e006257-u.jws'),'6257');
  const waiting=normalizeResult(raw,'president','https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br');assert.ok(waiting.candidates.every(c=>c.rank===null));
  const started=structuredClone(raw);started.and='p';started.s.st='1';let votes=100;
  for(const ag of started.carg[0].agr)for(const party of ag.par)for(const c of party.cand){c.vap=String(votes++);c.pvapn='1';}
  const top=normalizeResult(started,'president','https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br').candidates.slice(0,2);
  assert.equal(top.length,2);assert.ok(top[0].votes>top[1].votes);assert.deepEqual(top.map(c=>c.rank),[1,2]);
});
test('rejeita cargo trocado',() => assert.throws(() => parseResult(rawFederal(),'stateDeputy','6259')));
test('converte decimal oficial e rejeita número inválido',() => { assert.equal(parseNumber('42,81'),42.81); assert.throws(() => parseNumber('NaN')); });
test('horário do TSE é interpretado em Brasília',() => assert.equal(officialTimestamp('04/10/2026','17:24:11'),'2026-10-04T20:24:11.000Z'));
test('zerésima não produz ranking ou liderança',() => { const n=normalized(); assert.equal(n.meta.status,'waiting'); assert.ok(n.candidates.every(c => c.rank===null)); });
test('identifica Daniela com número, partido e ID oficiais',() => {
  const c=findCandidate(normalized().candidates,'Daniela Reinehr'); assert.equal(c?.id,'240002539382'); assert.equal(c.number,'2210'); assert.equal(c.party,'PL');
});
test('identifica Oscar no cargo estadual correto',() => {
  const r=parseResult(official('sc-c0007-e006259-u.jws'),'stateDeputy','6259');
  const c=findCandidate(normalizeResult(r,'stateDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc').candidates,'Oscar Gutz');
  assert.equal(c?.id,'240002539988'); assert.equal(c.number,'22470'); assert.equal(c.office,'stateDeputy');
});
test('identificação ambígua não escolhe candidato arbitrário',() => { const c=normalized().candidates[0]; assert.equal(findCandidate([c,{...c,id:'2'}],c.name),null); });
test('ranking nominal usa votos em ordem decrescente',() => {
  const n=normalizeResult(voting(),'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc');
  assert.ok(n.candidates[0].votes>n.candidates[1].votes); assert.equal(n.candidates[0].rank,1);
});
test('empates compartilham posição',() => {
  const c=normalized().candidates.slice(0,3).map((c,i)=>({...c,votes:i<2?100:90}));
  assert.deepEqual(rankCandidates(c,true).map(c=>c.rank),[1,1,3]);
});
test('primeiro por votos não vira eleito automaticamente',() => {
  const n=normalizeResult(voting(),'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc');
  assert.equal(n.candidates[0].officialElected,false); assert.equal(n.candidates[0].officialStatus,null);
});
test('quadro por posição mantém os empatados no limite de vagas e ordena a lista',()=>{
  const sample=normalized().candidates.slice(0,4).map((c,i)=>({...c,rank:[3,1,2,2][i],votes:[80,100,90,90][i]}));
  assert.deepEqual(leadingPositions(sample,2).map(c=>c.rank),[1,2,2]);
});
test('quadro por posição não mostra nomes antes da contagem nem inventa quantidade de vagas',()=>{
  assert.deepEqual(leadingPositions(normalized().candidates,16),[]);
  for(const seats of [null,undefined,0,-1,1.5])assert.deepEqual(leadingPositions([{...normalized().candidates[0],rank:1}],seats),[]);
});
test('eleito fora das primeiras posições aparece na visualização de confirmação',()=>{
  const sample=[{...normalized().candidates[0],rank:1,officialElected:false},{...normalized().candidates[1],rank:25,officialElected:true}];
  assert.equal(leadingPositions(sample,16)[0].officialElected,false);
  assert.deepEqual(confirmedElected(sample).map(c=>c.rank),[25]);
});
test('quadro de eleitos inclui confirmação por QP e média, mesmo fora do top 20',()=>{
  const raw=voting();const candidates=raw.carg[0].agr.flatMap(a=>a.par.flatMap(p=>p.cand));
  for(const [index,status] of [[0,'Eleito por QP'],[1,'Eleito por média']] as const){candidates[index].e='s';candidates[index].st=status;}
  const result=normalizeResult(raw,'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc');
  const elected=confirmedElected(result.candidates);assert.equal(elected.length,2);assert.ok(elected.every(c=>c.rank!>20));
  assert.equal(result.candidates[0].officialElected,false);
});
test('segundo turno não é tratado como eleição de presidente ou governador',()=>{
  for(const office of ['president','governor'] as const){
    assert.equal(electedByTse(office,true,'2º turno'),false);
    assert.equal(electedByTse(office,true,null,'s'),false);
    assert.equal(electedByTse(office,true,null),false);
    assert.equal(electedByTse(office,true,'Eleito'),true);
    assert.equal(electedByTse(office,true,null,'e'),true);
  }
});
test('normalização da presidência respeita a definição matemática e o segundo turno',()=>{
  const raw=parseNationalPresident(official('br-c0001-e006257-u.jws'),'6257');raw.and='p';raw.s.st='1';raw.md='s';
  const candidate=raw.carg[0].agr[0].par[0].cand[0];candidate.e='s';candidate.st='2º turno';
  const directory='https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br';
  assert.equal(normalizeResult(raw,'president',directory).candidates.find(c=>c.id===String(candidate.sqcand))?.officialElected,false);
  raw.md='e';candidate.st='';assert.equal(normalizeResult(raw,'president',directory).candidates.find(c=>c.id===String(candidate.sqcand))?.officialElected,true);
});
test('suplente ou não eleito não entra no quadro, mesmo com sinal conflitante',()=>{
  for(const office of ['federalDeputy','stateDeputy','senator'] as const){
    assert.equal(electedByTse(office,true,'Suplente'),false);
    assert.equal(electedByTse(office,true,'Não eleito'),false);
    assert.equal(electedByTse(office,false,'Eleito'),false);
    assert.equal(electedByTse(office,true,'Eleito'),true);
  }
});
test('zerésima nunca exibe eleito, mesmo que um sinal seja recebido antes da totalização',()=>{
  const raw=rawFederal();raw.carg[0].agr[0].par[0].cand[0].e='s';raw.carg[0].agr[0].par[0].cand[0].st='Eleito';
  assert.deepEqual(confirmedElected(normalizeResult(raw,'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc').candidates),[]);
});
test('suspensão de divulgação oculta votação',() => {
  const n=normalizeResult({...voting(),dv:'n'},'federalDeputy','https://resultados.tse.jus.br/oficial/ele2026/6259/fotos/sc');
  assert.equal(n.meta.status,'unavailable'); assert.equal(n.candidates.length,0); assert.equal(n.meta.percentage,null);
});
test('variações de votos e posição são independentes',() => {
  const c={...normalized().candidates[0],votes:200,rank:18} as Candidate;
  const p={...c,votes:150,rank:17}; const t=track(c,p,[{...c,id:'above',votes:250,rank:17},c]);
  assert.equal(t.voteDelta,50); assert.equal(t.rankDelta,-1); assert.equal(t.gapAbove,50);
});
test('primeiro snapshot não inventa variação',() => assert.equal(track(normalized().candidates[0],null,[]).voteDelta,null));
test('soma municipal exclui ausência de dados e evita duplicação',() => {
  const s=sumRegional([municipal('Caibi',100),municipal('Cunha Porã',200),municipal('Cunha Porã',200),municipal('Riqueza',null)]);
  assert.equal(s.total,300); assert.equal(s.available,2); assert.equal(s.largest?.name,'Cunha Porã');
});
test('ausência municipal não aparece como zero',() => assert.equal(sumRegional([municipal('Caibi',null)]).total,null));
test('novo visitante inicia sem candidatos ou cidades definidos',()=>assert.deepEqual(emptyPreferences(),{version:1,candidates:[],regional:[]}));
test('preferências inválidas ou de versão desconhecida não são carregadas',()=>{
  for(const value of [null,{},'bad',{version:2,candidates:[],regional:[]},{version:1,candidates:[{candidateId:'x',office:'governor'}],regional:[]}])assert.deepEqual(parsePreferences(value),emptyPreferences());
});
test('preferências deduplicam candidatos e cidades por ID e cargo',()=>{
  const c={office:'federalDeputy',candidateId:'123'};
  const p=parsePreferences({version:1,candidates:[c,c],regional:[{...c,municipalityCodes:['80594','80594','80918']}]});
  assert.equal(p.candidates.length,1);assert.deepEqual(p.regional[0].municipalityCodes,['80594','80918']);
});
test('candidatos do mesmo cargo compartilham a consulta municipal',()=>{
  const requests=municipalRequests([{office:'federalDeputy',candidateId:'1',municipalityCodes:['80594']},{office:'federalDeputy',candidateId:'2',municipalityCodes:['80594']},{office:'stateDeputy',candidateId:'3',municipalityCodes:['80918']}]);
  assert.deepEqual(requests,[{office:'federalDeputy',code:'80594'},{office:'stateDeputy',code:'80918'}]);
});
test('consulta rejeita entradas malformadas e limita quantidade',()=>{
  assert.deepEqual(parseRegionalQuery('governor:80594,governor:80594'),[{office:'governor',code:'80594'}]);
  for(const q of ['other:80594','governor:abcde','governor:80594:extra',Array(31).fill('governor:80594').join(',')])assert.throws(()=>parseRegionalQuery(q));
});
test('cada candidato usa seus votos e suas próprias cidades',()=>{
  const s=emptySnapshot();s.municipalities=[{name:'Caibi',code:'80594'},{name:'Cunha Porã',code:'80918'}];
  s.municipalResults['federalDeputy:80594']={office:'federalDeputy',municipality:s.municipalities[0],meta:{...s.offices.federalDeputy,status:'counting',percentage:55},stale:false,candidateVotes:{'1':{votes:400,percentage:10},'2':{votes:200,percentage:5}}};
  assert.equal(regionalRows({office:'federalDeputy',candidateId:'1',municipalityCodes:['80594']},s)[0].votes,400);
  assert.equal(regionalRows({office:'federalDeputy',candidateId:'2',municipalityCodes:['80594']},s)[0].votes,200);
  const missing=regionalRows({office:'stateDeputy',candidateId:'3',municipalityCodes:['80918']},s)[0];assert.equal(missing.name,'Cunha Porã');assert.equal(missing.votes,null);
  assert.equal(regionalRows({office:'federalDeputy',candidateId:'99',municipalityCodes:['80594']},s)[0].status,'unavailable');
});
test('cache deduplica chamadas simultâneas',async () => {
  let calls=0; const c=new SnapshotCache<number>(10000,()=>-1); const loader=async()=>{calls++;await Promise.resolve();return 42;};
  assert.deepEqual(await Promise.all([c.get(loader),c.get(loader),c.get(loader)]),[42,42,42]); await c.get(loader);assert.equal(calls,1);
});
test('cache preserva último snapshot em erro',async () => {
  const c=new SnapshotCache<{value:number;stale?:boolean}>(0,(last)=>({...last!,stale:true}));
  await c.get(async()=>({value:123})); const next=await c.get(async()=>{throw new Error('network');}); assert.equal(next.value,123);assert.equal(next.stale,true);
});
test('cliente bloqueia fontes não oficiais',async () => {await assert.rejects(fetchOfficial('https://example.com/result.jws'));await assert.rejects(fetchOfficial('https://resultados-sim.tse.jus.br/simulado/a.jws'));});
test('integração: catálogo SC, consultas sob demanda, cache e erro',async()=>{
  let requests=0;const realFetch=globalThis.fetch,realNow=Date.now;
  mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{
    const url=new URL(String(input));requests++;
    const name=url.pathname.split('/').at(-1)!;const path=join(process.cwd(),'tests/fixtures',name);
    return existsSync(path)?new Response(fixture(name),{status:200}):new Response('',{status:404});
  });
  try{
    const s=await getElectionSnapshot();assert.equal(s.status,'waiting');assert.equal(s.stale,false);assert.equal(s.source.verifiedSignatures,true);assert.equal(s.source.files.length,8);assert.equal(s.nationalPresident.meta.status,'waiting');assert.deepEqual(s.nationalPresident.candidates,[]);
    assert.equal(s.municipalities.length,295);assert.equal(new Set(s.municipalities.map(m=>m.code)).size,295);assert.deepEqual(s.municipalResults,{});
    const before=requests;await getElectionSnapshot();assert.equal(requests,before);
    await assert.rejects(getElectionSnapshot([{office:'governor',code:'99999'}]),/fora de Santa Catarina/);assert.equal(requests,before);
    const chosen=[{office:'federalDeputy' as const,code:'80594'},{office:'stateDeputy' as const,code:'80918'}];
    const local=await getElectionSnapshot(chosen);assert.equal(local.source.files.length,10);assert.equal(requests,before+2);
    assert.equal(local.municipalResults['federalDeputy:80594'].municipality.name,'CAIBI');assert.equal(local.municipalResults['stateDeputy:80918'].meta.status,'waiting');
    assert.deepEqual(local.municipalResults['stateDeputy:80918'].candidateVotes,{});
    await getElectionSnapshot([...chosen,chosen[0]]);assert.equal(requests,before+2);
    const original=realNow();Date.now=()=>original+13000;globalThis.fetch=async()=>{throw new Error('offline');};
    const stale=await getElectionSnapshot(chosen);assert.equal(stale.stale,true);assert.deepEqual(stale.stateDeputy,s.stateDeputy);assert.equal(stale.municipalResults['stateDeputy:80918'].stale,true);
  }finally{globalThis.fetch=realFetch;Date.now=realNow;mock.restoreAll();}
});
test('cliente limita concorrência global e compartilha arquivo simultâneo',async()=>{
  const realFetch=globalThis.fetch;let active=0,max=0,calls=0;
  globalThis.fetch=async()=>{calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return new Response(fixture('ele-c.jws'),{status:200});};
  try{
    const urls=Array.from({length:12},(_,i)=>`https://resultados.tse.jus.br/oficial/tests/concurrency-${i}.jws`);
    await Promise.all([...urls,urls[0],urls[0]].map(url=>fetchOfficial(url)));
    assert.equal(calls,12);assert.equal(max,6);
  }finally{globalThis.fetch=realFetch;}
});
