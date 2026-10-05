'use client';
import {useEffect,useState} from 'react';
import {parseProgressHistory,recordProgressHistory,type ProgressHistory} from '@/lib/live-features';
import type {BrazilProgress} from '@/services/tse/progress';
const KEY='eleicoes-2026:progress-history:v1';
export function useProgressHistory(data:BrazilProgress|null){
  const [history,setHistory]=useState<ProgressHistory>({}),[ready,setReady]=useState(false),[warning,setWarning]=useState<string|null>(null);
  useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(!active)return;try{setHistory(parseProgressHistory(JSON.parse(localStorage.getItem(KEY)||'{}')));}catch{setWarning('O histórico anterior não pôde ser recuperado.');}setReady(true);});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!ready||!data)return;let active=true;const next=recordProgressHistory(history,data);
    if(next===history)return;
    void Promise.resolve().then(()=>{if(!active)return;setHistory(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{setWarning('Histórico disponível nesta visita; o navegador não permitiu salvá-lo.');}});
    return()=>{active=false;};
  },[data,ready,history]);
  return {history,warning};
}
