import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {getPresidentsByState} from '../services/tse/service';
test('dois mais votados por UF validam abrangência, cache, espera e preservação individual em falha',async()=>{
  const originalFetch=globalThis.fetch,originalNow=Date.now;
  let requests=0,wrongScope=false;
  globalThis.fetch=async input=>{
    requests++;
    let name=new URL(String(input)).pathname.split('/').at(-1)!;
    if(wrongScope&&name==='sp-c0001-e006257-u.jws')name='df-c0001-e006257-u.jws';
    const path=join(process.cwd(),'tests/fixtures',name);
    return existsSync(path)?new Response(readFileSync(path,'utf8')):new Response('',{status:404});
  };
  try{
    const result=await getPresidentsByState();
    assert.equal(result.states.length,27);assert.equal(new Set(result.states.map(s=>s.uf)).size,27);
    assert.ok(!result.states.some(s=>['BR','ZZ'].includes(s.uf)));
    const sc=result.states.find(s=>s.uf==='SC')!,sp=result.states.find(s=>s.uf==='SP')!,df=result.states.find(s=>s.uf==='DF')!,ac=result.states.find(s=>s.uf==='AC')!;
    assert.equal(sc.meta.status,'waiting');assert.deepEqual(sc.candidates,[]);assert.equal(sc.verifiedSignatures,true);
    for(const state of [sp,df]){assert.equal(state.verifiedSignatures,true);assert.equal(state.candidates.length,2);assert.deepEqual(state.candidates.map(c=>c.rank),[1,2]);assert.ok(state.candidates[0].votes>state.candidates[1].votes);assert.ok(state.source.includes(`/${state.uf.toLowerCase()}-c0001`));}
    assert.deepEqual(ac.candidates,[]);assert.equal(ac.meta.percentage,null);assert.equal(ac.verifiedSignatures,false);assert.equal(ac.stale,true);
    const before=requests;await getPresidentsByState();assert.equal(requests,before);
    const now=originalNow();Date.now=()=>now+31000;wrongScope=true;
    const mixed=await getPresidentsByState();
    const staleSP=mixed.states.find(s=>s.uf==='SP')!;assert.equal(staleSP.stale,true);assert.deepEqual(staleSP.candidates,sp.candidates);assert.equal(mixed.states.find(s=>s.uf==='DF')!.stale,false);
    Date.now=()=>now+62000;globalThis.fetch=async()=>{throw new Error('offline');};
    const failed=await getPresidentsByState();assert.equal(failed.stale,true);assert.deepEqual(failed.states.find(s=>s.uf==='DF')!.candidates,df.candidates);assert.ok(failed.states.every(s=>s.stale));
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
