'use client';
import {useEffect,useRef,useState} from 'react';
import {candidateChanges,type CandidateAlert} from '@/lib/live-features';
import type {ElectionSnapshot,WatchPreferences} from '@/types/election';
export function useCandidateAlerts(snapshot:ElectionSnapshot|null,preferences:WatchPreferences){
  const [alerts,setAlerts]=useState<CandidateAlert[]>([]),[enabled,setEnabled]=useState(true);
  const previous=useRef<ElectionSnapshot|null>(null);
  useEffect(()=>{void Promise.resolve().then(()=>{try{setEnabled(localStorage.getItem('eleicoes-2026:alerts')!=='off');}catch{/* Use in-page notices. */}});},[]);
  useEffect(()=>{
    if(!snapshot)return;
    const events=enabled?candidateChanges(previous.current,snapshot,[...preferences.candidates,...preferences.regional]):[];
    previous.current=snapshot;
    let active=true;if(events.length)void Promise.resolve().then(()=>{if(active)setAlerts(old=>[...new Map([...events,...old].map(e=>[e.id,e])).values()].slice(0,20));});
    return()=>{active=false;};
  },[snapshot,preferences,enabled]);
  function toggle(){setEnabled(value=>{try{localStorage.setItem('eleicoes-2026:alerts',value?'off':'on');}catch{/* Current choice remains available. */}return !value;});}
  return {alerts,enabled,toggle,clear:()=>setAlerts([])};
}
