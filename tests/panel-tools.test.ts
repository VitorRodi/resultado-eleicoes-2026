import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyOfficialJws} from '../services/tse/client';
import {parseResult} from '../services/tse/parser';
import {normalizeResult} from '../services/tse/normalize';
import {emptySnapshot} from '../services/tse/service';
import {matchesCandidate,recordHistory,parseHistory,groupParties,selectedResultsCsv,municipalPosition,csvCell} from '../lib/panel-tools';
import type {Candidate,PartyResult,WatchPreferences} from '../types/election';
const c=(id:string,votes:number,rank:number):Candidate=>({id,name:'JOSÉ DA SILVA',fullName:'José da Silva',number:'22123',party:'PL',office:'stateDeputy',votes,percentage:12.3,rank,officialStatus:null,officialElected:false,photoUrl:null,destination:null});
function snapshot(){const s=emptySnapshot();s.stateDeputy=[c('1',100,1),c('2',80,2)];s.source.verifiedSignatures=true;s.offices.stateDeputy={status:'counting',updatedAt:'2026-10-04T21:00:00.000Z',generation:'1',percentage:30,sections:3,totalSections:10,seats:40};return s;}
test('busca combina nome sem acento, número, partido e federação',()=>{
  assert.equal(matchesCandidate(c('1',0,1),'jose PL 221'),true);assert.equal(matchesCandidate(c('1',0,1),'jose PT'),false);
  assert.equal(matchesCandidate({...c('1',0,1),federation:'Brasil da Esperança'},'esperanca'),true);
});
test('histórico não duplica a geração, rejeita regressão de tempo e preserva correções de votos',()=>{
  const s=snapshot(),first=recordHistory({},s,s.stateDeputy);assert.equal(first['stateDeputy:1'].length,1);
  assert.strictEqual(recordHistory(first,s,s.stateDeputy),first);
  s.offices.stateDeputy.generation='2';s.offices.stateDeputy.updatedAt='2026-10-04T21:01:00.000Z';s.stateDeputy[0].votes=90;
  const next=recordHistory(first,s,s.stateDeputy);assert.deepEqual(next['stateDeputy:1'].map(p=>p.votes),[100,90]);
  s.offices.stateDeputy.updatedAt='2026-10-04T20:00:00.000Z';assert.strictEqual(recordHistory(next,s,s.stateDeputy),next);
  s.offices.stateDeputy.updatedAt='2026-10-04T21:01:00.000Z';s.offices.stateDeputy.generation='3';s.stateDeputy[0].votes=95;
  assert.deepEqual(recordHistory(next,s,s.stateDeputy)['stateDeputy:1'].map(p=>p.votes),[100,95]);
});
test('histórico não cria pontos de zerésima ou fonte não validada, e limita armazenamento',()=>{
  const s=snapshot();s.source.verifiedSignatures=false;assert.deepEqual(recordHistory({},s,s.stateDeputy),{});
  s.source.verifiedSignatures=true;s.offices.stateDeputy.status='waiting';assert.deepEqual(recordHistory({},s,s.stateDeputy),{});
  const point={at:'2026-10-04T21:00:00.000Z',generation:'1',votes:1,percentage:10,rank:1};
  const parsed=parseHistory({'stateDeputy:1':[...Array(300).fill(point),{...point,rank:0},{...point,percentage:101}],'other:1':[point]});
  assert.equal(parsed['stateDeputy:1'].length,240);assert.equal(parsed['other:1'],undefined);
});
test('posição municipal inclui todos os candidatos e respeita empate, sem transformar ausência em zero',()=>{
  const votes={'1':{votes:80},'2':{votes:100},'3':{votes:80},'4':{votes:70}};
  assert.equal(municipalPosition(votes,'1'),2);assert.equal(municipalPosition(votes,'3'),2);assert.equal(municipalPosition(votes,'missing'),null);
});
test('normalização preserva federações e usa votos válidos nominais e de legenda oficiais',()=>{
  const raw=parseResult(verifyOfficialJws(readFileSync('tests/fixtures/sc-c0007-e006259-u.jws','utf8')),'stateDeputy','6259');
  raw.and='p';raw.s.st='1';const federation=raw.carg[0].agr.find(g=>g.tp==='f')!;
  federation.par[0].tvtn='100';federation.par[0].tvtl='30';federation.par[0].cand[0].vap='9999';
  const n=normalizeResult(raw,'stateDeputy','https://resultados.tse.jus.br/oficial/photos');
  assert.equal(n.parties.find(p=>p.id===federation.par[0].sg)?.nominalVotes,100);
  assert.equal(n.parties.find(p=>p.id===federation.par[0].sg)?.legendVotes,30);
  assert.equal(n.candidates.find(c=>c.id===String(federation.par[0].cand[0].sqcand))?.federation,federation.nm);
  raw.dv='n';assert.deepEqual(normalizeResult(raw,'stateDeputy','').parties,[]);
});
test('federação agrega membros uma vez, mantendo votos desconhecidos distintos de zero',()=>{
  const party=(id:string,votes:number|null,electedIds:string[]):PartyResult=>({id,label:id,name:id,federation:'F',nominalVotes:votes,legendVotes:10,electedIds});
  const groups=groupParties([party('A',100,['1']),party('B',200,['2'])],true);
  assert.equal(groups.length,1);assert.equal(groups[0].nominalVotes,300);assert.equal(groups[0].legendVotes,20);assert.deepEqual(groups[0].electedIds,['1','2']);
  assert.equal(groupParties([party('A',null,[]),party('B',200,[])],true)[0].nominalVotes,null);
  assert.equal(groupParties([party('A',100,[]),party('B',200,[])],false).length,2);
});
test('CSV inclui estado, municípios, horário, situação e cargo sem inventar resultados indisponíveis',()=>{
  const s=snapshot(),p:WatchPreferences={version:1,candidates:[{office:'stateDeputy',candidateId:'1'}],regional:[{office:'stateDeputy',candidateId:'1',municipalityCodes:['80594']}]};
  s.municipalities=[{code:'80594',name:'Caibi'}];
  const csv=selectedResultsCsv(s,p);assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.split('\r\n').length,3);assert.match(csv,/"Caibi"/);assert.match(csv,/"18:00:00"|18:00:00/);assert.match(csv,/"Resultado indisponível"/);
  assert.equal(selectedResultsCsv(s,p,'president').split('\r\n').length,1);
  assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(csvCell(null),'""');
});
