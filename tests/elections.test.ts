import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { verifyOfficialJws, fetchOfficial } from '../services/tse/client';
import { parseResult, parseNumber, officialTimestamp } from '../services/tse/parser';
import { normalizeResult } from '../services/tse/normalize';
import { rankCandidates } from '../lib/ranking';
import { findCandidate, track, sumRegional } from '../lib/tracking';
import { SnapshotCache } from '../lib/cache';
import { MUNICIPALITIES, canonical } from '../lib/config';
import { getElectionSnapshot } from '../services/tse/service';
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
test('lista regional contém nove municípios e Cunha Porã uma vez',() => {assert.equal(MUNICIPALITIES.length,9);assert.equal(MUNICIPALITIES.filter(n=>canonical(n)==='cunha pora').length,1);});
test('cache deduplica chamadas simultâneas',async () => {
  let calls=0; const c=new SnapshotCache<number>(10000,()=>-1); const loader=async()=>{calls++;await Promise.resolve();return 42;};
  assert.deepEqual(await Promise.all([c.get(loader),c.get(loader),c.get(loader)]),[42,42,42]); await c.get(loader);assert.equal(calls,1);
});
test('cache preserva último snapshot em erro',async () => {
  const c=new SnapshotCache<{value:number;stale?:boolean}>(0,(last)=>({...last!,stale:true}));
  await c.get(async()=>({value:123})); const next=await c.get(async()=>{throw new Error('network');}); assert.equal(next.value,123);assert.equal(next.stale,true);
});
test('cliente bloqueia fontes não oficiais',async () => {await assert.rejects(fetchOfficial('https://example.com/result.jws'));await assert.rejects(fetchOfficial('https://resultados-sim.tse.jus.br/simulado/a.jws'));});
test('integração: assinatura, cargos, 18 consultas municipais, cache e erro',async () => {
  let requests=0; const realFetch=globalThis.fetch, realNow=Date.now;
  mock.method(globalThis,'fetch',async (input:string|URL|Request)=>{
    const url=new URL(String(input)); requests++;
    const name=url.pathname.split('/').at(-1)!; const path=join(process.cwd(),'tests/fixtures',name);
    return existsSync(path)?new Response(fixture(name),{status:200}):new Response('',{status:404});
  });
  try {
    const s=await getElectionSnapshot(); assert.equal(s.status,'waiting');assert.equal(s.stale,false);assert.equal(s.source.verifiedSignatures,true);assert.equal(s.source.files.length,25);
    assert.equal(s.trackedCandidates.danielaReinehr.candidate?.number,'2210');assert.equal(s.trackedCandidates.oscarGutz.candidate?.number,'22470');
    for (const key of ['danielaReinehr','oscarGutz'] as const) {const rows=s.regionalMunicipalVotes[key];assert.equal(rows.length,9);assert.equal(new Set(rows.map(r=>r.code)).size,9);assert.ok(rows.every(r=>r.votes===null));}
    const before=requests;await getElectionSnapshot();assert.equal(requests,before);
    const original=realNow();Date.now=()=>original+13000;globalThis.fetch=async()=>{throw new Error('offline');};
    const stale=await getElectionSnapshot();assert.equal(stale.stale,true);assert.equal(stale.trackedCandidates.oscarGutz.candidate?.id,s.trackedCandidates.oscarGutz.candidate?.id);
  } finally {globalThis.fetch=realFetch;Date.now=realNow;mock.restoreAll();}
});
