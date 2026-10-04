import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {verifyOfficialJws} from '../services/tse/client';
import {parseResult} from '../services/tse/parser';
import {normalizeResult} from '../services/tse/normalize';
import {getElectionSnapshot,getPresidentsByState} from '../services/tse/service';
const official=()=>verifyOfficialJws(readFileSync('tests/fixtures/sc-c0001-e006257-u.jws','utf8'));
const photoDirectory='https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br';
function voting(){const raw=parseResult(official(),'president','6257');raw.and='p';raw.s.st='1';raw.e={te:'1000',esa:'800',c:'600',a:'200',pcn:'75',pan:'25'};raw.v={tv:'600',vv:'500',vb:'40',tvn:'50',vn:'45',vnt:'5',ptvnn:'8.333333333',van:'4',vansj:'6',vscv:'0'};return raw;}
test('preserva total apto, comparecimento, abstenções e categorias oficiais, sem duplicar nulos técnicos',()=>{
  const stats=normalizeResult(voting(),'president',photoDirectory).statistics;
  assert.deepEqual([stats.eligible,stats.countedElectorate,stats.turnout,stats.abstentions],[1000,800,600,200]);
  assert.equal(stats.nullVotes,50);assert.equal(stats.technicalNullVotes,5);assert.equal(stats.nullVotesPercentage,8.333333333);
  assert.equal(stats.validVotes,500);assert.equal(stats.blankVotes,40);assert.equal(stats.totalVotes,600);
  assert.equal(stats.annulledVotes,4);assert.equal(stats.annulledSubJudiceVotes,6);
});
test('zerésima mostra somente o eleitorado conhecido; suspensão não revela nem os quantitativos recebidos',()=>{
  const raw=voting();raw.and='n';raw.s.st='0';const waiting=normalizeResult(raw,'president',photoDirectory).statistics;
  assert.equal(waiting.eligible,1000);assert.equal(waiting.turnout,null);assert.equal(waiting.nullVotes,null);assert.equal(waiting.nullVotesPercentage,null);
  raw.dv='n';assert.ok(Object.values(normalizeResult(raw,'president',photoDirectory).statistics).every(v=>v===null));
});
test('campos ausentes permanecem indisponíveis e zero divulgado durante a apuração permanece zero',()=>{
  const raw=voting();raw.v={tv:'600',vn:'45'};raw.e=undefined;const missing=normalizeResult(raw,'president',photoDirectory).statistics;
  assert.equal(missing.nullVotes,null);assert.equal(missing.eligible,null);assert.equal(missing.turnout,null);
  raw.v={tv:'600',tvn:'0',vnt:'0',ptvnn:'0'};const zero=normalizeResult(raw,'president',photoDirectory).statistics;
  assert.equal(zero.nullVotes,0);assert.equal(zero.nullVotesPercentage,0);
});
test('compatibilidade usa vn + vnt somente quando ambos existem; percentual usa total computado, nunca pvn',()=>{
  const raw=voting();raw.v={tv:'600',vn:'45',vnt:'5'};
  const stats=normalizeResult(raw,'president',photoDirectory).statistics;assert.equal(stats.nullVotes,50);assert.ok(Math.abs(stats.nullVotesPercentage!-50/600*100)<1e-9);
});
test('quantidades negativas, fracionárias e percentuais inválidos são rejeitados no parser',()=>{
  assert.throws(()=>parseResult({...voting(),e:{te:'-1'}},'president','6257'));
  assert.throws(()=>parseResult({...voting(),e:{c:'1.5'}},'president','6257'));
  assert.throws(()=>parseResult({...voting(),v:{tvn:'abc'}},'president','6257'));
  assert.throws(()=>parseResult({...voting(),v:{ptvnn:'101'}},'president','6257'));
});
test('estatísticas chegam por UF e cargo e preservam o último resultado válido em falhas',async()=>{
  const originalFetch=globalThis.fetch,originalNow=Date.now;
  globalThis.fetch=async(input)=>{const file=join('tests/fixtures',new URL(String(input)).pathname.split('/').at(-1)!);return new Response(existsSync(file)?readFileSync(file,'utf8'):'',{status:existsSync(file)?200:404});};
  try{
    const [sc,sp,states]=await Promise.all([getElectionSnapshot([],'sc'),getElectionSnapshot([],'sp'),getPresidentsByState()]);
    assert.equal(sc.statistics?.president?.eligible,5734651);assert.notEqual(sc.statistics?.president?.eligible,sp.statistics?.president?.eligible);
    assert.equal(states.states.find(s=>s.uf==='SC')?.statistics?.eligible,5734651);
    assert.equal(states.states.find(s=>s.uf==='AC')?.statistics?.nullVotes,undefined);
    const before=originalNow();Date.now=()=>before+31000;globalThis.fetch=async()=>{throw new Error('offline');};
    const [stale,staleStates]=await Promise.all([getElectionSnapshot([],'sc'),getPresidentsByState()]);
    assert.equal(stale.stale,true);assert.deepEqual(stale.statistics,sc.statistics);
    assert.equal(staleStates.stale,true);assert.deepEqual(staleStates.states.find(s=>s.uf==='SC')?.statistics,states.states.find(s=>s.uf==='SC')?.statistics);
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
