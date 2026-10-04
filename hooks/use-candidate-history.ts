'use client';
import {useEffect,useState} from 'react';
import {parseHistory,recordHistory,type CandidateHistory,watchedCandidates} from '@/lib/panel-tools';
import type {ElectionSnapshot,WatchPreferences} from '@/types/election';
export function useCandidateHistory(uf:string,snapshot:ElectionSnapshot|null,preferences:WatchPreferences){
  const [history,setHistory]=useState<CandidateHistory>({}),[warning,setWarning]=useState<string|null>(null);
  const [ready,setReady]=useState(false);
  const key=`eleicoes-2026:history:${uf}:v1`;
  useEffect(()=>{
    let active=true;
    void Promise.resolve().then(()=>{
      if(!active)return;
      try{setHistory(parseHistory(JSON.parse(localStorage.getItem(key)||'{}')));}
      catch{setWarning('O histórico anterior não pôde ser recuperado. Novas atualizações serão registradas nesta visita.');}
      setReady(true);
    });return()=>{active=false;};
  },[key]);
  useEffect(()=>{
    if(!snapshot||!ready)return;
    const next=recordHistory(history,snapshot,watchedCandidates(snapshot,preferences));
    if(next===history)return;
    let active=true;
    // Persist exactly the displayed samples; duplicate generations never create points.
    void Promise.resolve().then(()=>{
      if(!active)return;
      setHistory(next);
      try{localStorage.setItem(key,JSON.stringify(next));}
      catch{setWarning('O navegador não permitiu salvar o histórico. Ele continua disponível nesta visita.');}
    });
    return()=>{active=false;};
  },[snapshot,preferences,history,key,ready]);
  return {history,warning};
}
