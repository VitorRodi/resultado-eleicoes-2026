import {z} from 'zod';
import {BRAZIL_STATES} from './brazil-states';
import {municipalRequests,parsePreferences,preferencesSchema,selectionKey} from './preferences';
import type {BrazilProgress,StateProgress} from '../services/tse/progress';
import type {CandidateSelection,ElectionSnapshot,WatchPreferences} from '../types/election';
export type StateSort='alphabetical'|'remaining'|'most'|'least';
export function remainingSections(p:{sections:number|null;totalSections:number|null}|undefined){return p?.sections!=null&&p.totalSections!=null?p.totalSections-p.sections:null;}
export function orderStates<T extends {name:string;status:string;percentage:number|null;sections:number|null;totalSections:number|null}>(states:T[],sort:StateSort,pending:boolean):T[]{
  return states.filter(s=>!pending||s.status!=='finished').sort((a,b)=>{
    const alpha=()=>a.name.localeCompare(b.name,'pt-BR');
    if(sort==='alphabetical')return alpha();
    const x=sort==='remaining'?remainingSections(a):a.percentage,y=sort==='remaining'?remainingSections(b):b.percentage;
    if(x==null)return y==null?alpha():1;if(y==null)return -1;
    return (sort==='least'?x-y:y-x)||alpha();
  });
}
const shareSchema=z.object({v:z.literal(1),uf:z.string().refine(uf=>BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf)),preferences:preferencesSchema});
export function sharedPanelLink(origin:string,uf:string,preferences:WatchPreferences){
  const value=shareSchema.parse({v:1,uf,preferences});
  if(municipalRequests(value.preferences.regional).length>30)throw new Error('O painel excede o limite de cidades.');
  const encoded=btoa(JSON.stringify(value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(encoded.length>30000)throw new Error('Selecione menos cidades para gerar um link menor.');
  const url=new URL('/',origin);url.searchParams.set('uf',uf);url.hash=`painel=${encoded}`;return url.href;
}
export function readSharedPanel(href:string){
  try{
    const url=new URL(href),encoded=new URLSearchParams(url.hash.slice(1)).get('painel');
    if(!encoded||encoded.length>30000||!/^[a-zA-Z0-9_-]+$/.test(encoded))return null;
    const value=shareSchema.parse(JSON.parse(atob(encoded.replace(/-/g,'+').replace(/_/g,'/'))));
    if(url.searchParams.get('uf')!==value.uf||municipalRequests(value.preferences.regional).length>30)return null;
    return {uf:value.uf,preferences:parsePreferences(value.preferences)};
  }catch{return null;}
}
export type CandidateAlert={id:string;name:string;office:string;at:string;kind:'rank'|'elected';from:number|null;to:number|null};
export function candidateChanges(previous:ElectionSnapshot|null,current:ElectionSnapshot,choices:CandidateSelection[]):CandidateAlert[]{
  if(!previous||previous.state.uf!==current.state.uf||!current.source.verifiedSignatures)return [];
  return [...new Map(choices.map(c=>[selectionKey(c),c])).values()].flatMap(choice=>{
    const oldMeta=previous.offices[choice.office],meta=current.offices[choice.office];
    if(meta.stale||!meta.generation||meta.generation===oldMeta.generation||!meta.updatedAt||!oldMeta.updatedAt||meta.updatedAt<=oldMeta.updatedAt||!['counting','finished'].includes(meta.status))return [];
    const old=previous[choice.office].find(c=>c.id===choice.candidateId),c=current[choice.office].find(c=>c.id===choice.candidateId);
    if(!old||!c)return [];
    const base={name:c.name,office:c.office,at:meta.updatedAt,from:old.rank,to:c.rank};const events:CandidateAlert[]=[];
    if(c.rank!==null&&old.rank!==null&&c.rank<old.rank)events.push({...base,id:`${selectionKey(choice)}:${meta.generation}:rank`,kind:'rank'});
    if(c.officialElected&&!old.officialElected)events.push({...base,id:`${selectionKey(choice)}:${meta.generation}:elected`,kind:'elected'});
    return events;
  });
}
export type ProgressSample={at:string;percentage:number;sections:number;totalSections:number};
export type ProgressHistory=Record<string,ProgressSample[]>;
const sampleSchema=z.object({at:z.string().datetime(),percentage:z.number().min(0).max(100),sections:z.number().int().min(0),totalSections:z.number().int().min(0)}).refine(p=>p.sections<=p.totalSections);
export function parseProgressHistory(raw:unknown):ProgressHistory{
  if(!raw||typeof raw!=='object')return {};
  return Object.fromEntries(BRAZIL_STATES.map(s=>{
    const list=(raw as Record<string,unknown>)[s.uf];let last=0;
    const samples=Array.isArray(list)?list.slice(-240).flatMap(p=>{const r=sampleSchema.safeParse(p);if(!r.success||Date.parse(r.data.at)<=last)return [];last=Date.parse(r.data.at);return [r.data];}):[];
    return [s.uf,samples];
  }));
}
export function recordProgressHistory(history:ProgressHistory,data:BrazilProgress):ProgressHistory{
  if(data.stale||!data.updatedAt||!Number.isFinite(Date.parse(data.updatedAt)))return history;
  let next=history;
  for(const s of data.states){
    if(s.status==='unavailable'||s.percentage==null||s.sections==null||s.totalSections==null)continue;
    const list=history[s.uf]||[],last=list.at(-1);
    if(last&&(last.at>=data.updatedAt||last.sections===s.sections&&last.totalSections===s.totalSections&&last.percentage===s.percentage))continue;
    const sample={at:data.updatedAt,percentage:s.percentage,sections:s.sections,totalSections:s.totalSections};
    if(!sampleSchema.safeParse(sample).success)continue;
    if(next===history)next={...history};next[s.uf]=[...list,sample].slice(-240);
  }return next;
}
export function progressStates(states:typeof BRAZIL_STATES,data:BrazilProgress|null):StateProgress[]{return states.map(s=>data?.states.find(p=>p.uf===s.uf)||{uf:s.uf,name:s.name,percentage:null,sections:null,totalSections:null,status:'unavailable'});}
