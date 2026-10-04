'use client';
import { useEffect, useState } from 'react';
import { BRAZIL_STATES } from '@/lib/brazil-states';
import type { PresidentsByStateSnapshot } from '@/types/election';
export function usePresidentsByState(){
  const [data,setData]=useState<PresidentsByStateSnapshot|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    let cancelled=false,active:AbortController|null=null;
    async function refresh(){
      if(active||document.hidden)return;
      const abort=new AbortController();active=abort;
      const timeout=window.setTimeout(()=>abort.abort(),60_000);
      try{
        const response=await fetch('/api/elections/br/president/states',{cache:'no-store',signal:abort.signal});
        if(!response.ok)throw new Error('Resultados indisponíveis.');
        const result:PresidentsByStateSnapshot=await response.json();
        if(!Array.isArray(result.states)||result.states.length!==27||new Set(result.states.map(s=>s.uf)).size!==27||!result.states.every(s=>BRAZIL_STATES.some(uf=>uf.uf===s.uf)&&Array.isArray(s.candidates)&&s.meta))throw new Error('Estados inválidos.');
        if(cancelled)return;
        setData(previous=>{
          const states=result.states.map(s=>{
            const prior=previous?.states.find(p=>p.uf===s.uf);
            return prior?.verifiedSignatures&&(!s.verifiedSignatures||(prior.meta.updatedAt&&(!s.meta.updatedAt||s.meta.updatedAt<prior.meta.updatedAt)))?{...prior,stale:true}:s;
          });return {...result,states,stale:states.some(s=>s.stale)};
        });setError(false);
      }catch{if(!cancelled)setError(true);}
      finally{window.clearTimeout(timeout);active=null;}
    }
    void refresh();const timer=window.setInterval(()=>void refresh(),30_000);
    const onVisible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',onVisible);
    return()=>{cancelled=true;window.clearInterval(timer);active?.abort();document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  return {data,error};
}
