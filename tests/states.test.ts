import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseResult} from '../services/tse/parser';
import {verifyOfficialJws} from '../services/tse/client';
import {getElectionSnapshot} from '../services/tse/service';
import {officeLabel,officeCode} from '../lib/config';
import {OFFICES} from '../types/election';
const read=(name:string)=>readFileSync(join(process.cwd(),'tests/fixtures',name),'utf8');
test('parser aceita arquivos da UF selecionada e rejeita mistura de estados',()=>{
  const raw=verifyOfficialJws(read('sp-c0007-e006259-u.jws'));
  assert.equal(parseResult(raw,'stateDeputy','6259',undefined,'sp').cdabr,'sp');
  assert.throws(()=>parseResult(raw,'stateDeputy','6259',undefined,'sc'),/Abrangência/);
});
test('deputado distrital usa cargo 8 apenas no DF',()=>{
  const raw=verifyOfficialJws(read('df-c0008-e006259-u.jws'));
  assert.equal(parseResult(raw,'stateDeputy','6259',undefined,'df').carg[0].cd,'8');
  assert.equal(officeCode('stateDeputy','df'),8);assert.equal(officeCode('stateDeputy','sc'),7);
  assert.equal(officeLabel('stateDeputy','df'),'Deputado distrital');
  const parsed=parseResult(raw,'stateDeputy','6259',undefined,'df');
  assert.throws(()=>parseResult({...parsed,carg:[{...parsed.carg[0],cd:'7'}]},'stateDeputy','6259',undefined,'df'),/Cargo incorreto/);
});
test('snapshots e catálogos municipais são separados por UF, inclusive em falha',async()=>{
  const original=globalThis.fetch,originalNow=Date.now;
  globalThis.fetch=async(input)=>{const name=new URL(String(input)).pathname.split('/').at(-1)!;return new Response(existsSync(join(process.cwd(),'tests/fixtures',name))?read(name):'',{status:existsSync(join(process.cwd(),'tests/fixtures',name))?200:404});};
  try{
    const [sc,sp,df]=await Promise.all(['sc','sp','df'].map(uf=>getElectionSnapshot([],uf)));
    assert.deepEqual([sc.state.uf,sp.state.uf,df.state.uf],['sc','sp','df']);
    assert.deepEqual([sc.municipalities.length,sp.municipalities.length,df.municipalities.length],[295,645,1]);
    for(const snapshot of [sc,sp,df])assert.ok(OFFICES.every(o=>snapshot.offices[o].generation));
    assert.ok(sp.source.files.some(url=>url.includes('/sp/sp-c0007')));assert.ok(df.source.files.some(url=>url.includes('/df/df-c0008')));
    assert.ok(!sp.federalDeputy.some(c=>c.id==='240002539382'));
    await assert.rejects(getElectionSnapshot([], '../sc'),/UF inválida/);
    await assert.rejects(getElectionSnapshot([{office:'stateDeputy',code:'80594'}],'sp'),/fora de SP/);
    const now=originalNow();Date.now=()=>now+13000;globalThis.fetch=async()=>{throw new Error('offline');};
    const stale=await getElectionSnapshot([],'sp');assert.equal(stale.state.uf,'sp');assert.equal(stale.stale,true);assert.deepEqual(stale.stateDeputy,sp.stateDeputy);
  }finally{globalThis.fetch=original;Date.now=originalNow;}
});
