import { CONFIG_URL, TSE_ORIGIN, fetchOfficial } from './client';
import { configurationSchema, municipalitySchema, type TseConfiguration } from './types';
import { parseResult, parseNationalPresident } from './parser';
import { normalizeResult } from './normalize';
import { parseBrazilProgress, emptyBrazilProgress, type BrazilProgress } from './progress';
import {parseMunicipalProgress,type MunicipalProgressSnapshot,type MunicipalLeader} from './municipal-progress';
import { OFFICE_CONFIG, officeCode } from '../../lib/config';
import { BRAZIL_STATES } from '../../lib/brazil-states';
import { SnapshotCache } from '../../lib/cache';
import { municipalKey } from '../../lib/preferences';
import { OFFICES, type ElectionSnapshot, type Office, type OfficeMeta, type Municipality, type MunicipalRequest, type MunicipalResult, type NationalPresidentSnapshot, type PresidentsByStateSnapshot, type StatePresidentResult } from '../../types/election';

type Context = { uf:string; config:TseConfiguration; cycle:string; pleito:string; elections:Record<Office,string>; municipalities:Municipality[]; sources:string[] };
function directory(ctx:Omit<Context,'municipalities'|'sources'>,type:string,office:Office,scope:string=ctx.uf):string {
  const template=ctx.config.arq.find(a=>a.tp===type)?.dir;
  if (!template) throw new Error(`Diretório ${type} ausente no TSE.`);
  const replacements:Record<string,string>={base:TSE_ORIGIN,ambiente:'oficial',ciclo:ctx.cycle,cd_eleicao:ctx.elections[office],cd_pleito:ctx.pleito,uf:type==='ft'&&office==='president'?'br':scope};
  const result=template.replace(/<([^>]+)>/g,(_,token)=>{
    if (!(token in replacements)) throw new Error(`Token TSE desconhecido: ${token}`);
    return replacements[token];
  });
  if (!result.startsWith(`${TSE_ORIGIN}/oficial/`)) throw new Error('Diretório TSE inválido.');
  return result.replace(/\/$/,'');
}
export function resultUrl(ctx:Context,office:Office,municipality?:string) {
  return `${directory(ctx,'u',office)}/${ctx.uf}${municipality||''}-c${String(officeCode(office,ctx.uf)).padStart(4,'0')}-e${ctx.elections[office].padStart(6,'0')}-u.jws`;
}
const contextCaches=new Map<string,SnapshotCache<Context|null>>();
async function getContext(uf='sc'):Promise<Context> {
  if(!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf))throw new UnknownMunicipalityError('UF inválida.');
  if(!contextCaches.has(uf))contextCaches.set(uf,new SnapshotCache<Context|null>(300_000,last=>last||null));
  const ctx=await contextCaches.get(uf)!.get(async()=>{
    const config=configurationSchema.parse(await fetchOfficial(CONFIG_URL,300_000));
    const pleito=config.pl.find(p=>p.dt==='04/10/2026');
    if (!pleito || pleito.c!=='ele2026') throw new Error('Pleito de 2026 não encontrado na configuração oficial.');
    const elections={} as Record<Office,string>;
    for (const office of OFFICES) {
      const election=pleito.e.find(e=>e.t==='1' && Number(e.tp)===OFFICE_CONFIG[office].type && e.abr.some(a=>[uf,'br'].includes(a.cd.toLowerCase())&&a.cp.some(c=>Number(c.cd)===officeCode(office,uf))));
      if (!election) throw new Error(`Cargo ${office} não disponível para 2026.`);
      elections[office]=String(election.cd);
    }
    const partial={uf,config,cycle:pleito.c,pleito:String(pleito.cd),elections};
    const url=`${directory(partial,'cm','stateDeputy')}/mun-e${elections.stateDeputy.padStart(6,'0')}-cm.jws`;
    const municipalityConfig=municipalitySchema.parse(await fetchOfficial(url,300_000));
    const state=municipalityConfig.abr.find(a=>a.cd.toLowerCase()===uf);
    if (!state) throw new Error('UF ausente na configuração municipal.');
    const municipalities=state.mu.map(m=>({name:m.nm,code:String(m.cd).padStart(5,'0'),...(/^\d{7}$/.test(String(m.cdi??m.cdmi))?{ibgeCode:String(m.cdi??m.cdmi)}:{})})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    if (municipalities.some(m=>!/^\d{5}$/.test(m.code)) || new Set(municipalities.map(m=>m.code)).size!==municipalities.length)
      throw new Error('Configuração municipal inválida ou duplicada.');
    return {...partial,municipalities,sources:[CONFIG_URL,url]};
  });
  if (!ctx) throw new Error('Configuração oficial indisponível.');
  return ctx;
}
const emptyOffice=():OfficeMeta=>({status:'unavailable',percentage:null,sections:null,totalSections:null,updatedAt:null,generation:null,seats:null});
const nationalPresidentCache=new SnapshotCache<NationalPresidentSnapshot>(12_000,last=>({
  ...(last||{candidates:[],meta:emptyOffice(),source:{verifiedSignatures:false,files:[]}}),stale:true,checkedAt:new Date().toISOString(),
}));
export async function getNationalPresident():Promise<NationalPresidentSnapshot>{
  return nationalPresidentCache.get(async previous=>{
    const ctx=await getContext(),url=`${directory(ctx,'u','president','br')}/br-c0001-e${ctx.elections.president.padStart(6,'0')}-u.jws`;
    const normalized=normalizeResult(parseNationalPresident(await fetchOfficial(url),ctx.elections.president),'president',directory(ctx,'ft','president'));
    if(previous?.meta.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<previous.meta.updatedAt)throw new Error('Geração nacional anterior recebida.');
    return {...normalized,stale:false,checkedAt:new Date().toISOString(),source:{verifiedSignatures:true,files:[CONFIG_URL,url]}};
  });
}
export function emptySnapshot(uf='sc'):ElectionSnapshot {
  return {state:{uf,name:BRAZIL_STATES.find(s=>s.uf.toLowerCase()===uf)?.name||uf.toUpperCase()},status:'unavailable',updatedAt:null,checkedAt:new Date().toISOString(),stale:false,warnings:[],
    progress:{percentage:null,sections:null,totalSections:null,office:'governor'},
    president:[],governor:[],senator:[],federalDeputy:[],stateDeputy:[],leaders:{president:null,governor:null,senator:[]},nationalPresident:{candidates:[],meta:emptyOffice(),stale:false},
    offices:Object.fromEntries(OFFICES.map(o=>[o,emptyOffice()])) as Record<Office,OfficeMeta>,partyResults:{},statistics:{},municipalities:[],municipalResults:{},
    source:{name:'TSE / Justiça Eleitoral',url:TSE_ORIGIN,verifiedSignatures:false,files:[CONFIG_URL]}};
}
async function mapLimited<T,R>(items:T[],fn:(item:T)=>Promise<R>,concurrency=6):Promise<R[]> {
  const output=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{
    while(next<items.length){const i=next++;output[i]=await fn(items[i]);}
  }));return output;
}
const emptyPresidentsByState=():PresidentsByStateSnapshot=>({states:BRAZIL_STATES.map(s=>({uf:s.uf,name:s.name,candidates:[],meta:emptyOffice(),stale:true,verifiedSignatures:false,source:''})),stale:true,checkedAt:new Date().toISOString()});
const presidentsByStateCache=new SnapshotCache<PresidentsByStateSnapshot>(30_000,last=>({
  ...(last||emptyPresidentsByState()),states:(last||emptyPresidentsByState()).states.map(s=>({...s,stale:true})),stale:true,checkedAt:new Date().toISOString(),
}));
export async function getPresidentsByState():Promise<PresidentsByStateSnapshot>{
  return presidentsByStateCache.get(async previous=>{
    const ctx=await getContext();
    const states=await mapLimited([...BRAZIL_STATES],async state=>{
      const uf=state.uf.toLowerCase(),url=`${directory(ctx,'u','president',uf)}/${uf}-c0001-e${ctx.elections.president.padStart(6,'0')}-u.jws`;
      const prior=previous?.states.find(s=>s.uf===state.uf);
      try{
        const normalized=normalizeResult(parseResult(await fetchOfficial(url),'president',ctx.elections.president,undefined,uf),'president',directory(ctx,'ft','president'));
        if(prior?.meta.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<prior.meta.updatedAt)throw new Error('Geração estadual anterior recebida.');
        return {uf:state.uf,name:state.name,candidates:normalized.candidates.filter(c=>c.rank!==null).slice(0,2),meta:normalized.meta,statistics:normalized.statistics,stale:false,verifiedSignatures:true,source:url} satisfies StatePresidentResult;
      }catch{
        return prior?{...prior,stale:true}:{uf:state.uf,name:state.name,candidates:[],meta:emptyOffice(),stale:true,verifiedSignatures:false,source:url};
      }
    });
    return {states,stale:states.some(s=>s.stale),checkedAt:new Date().toISOString()};
  });
}
async function loadSnapshot(previous:ElectionSnapshot|undefined,uf='sc'):Promise<ElectionSnapshot> {
  const ctx=await getContext(uf),snapshot=emptySnapshot(uf);snapshot.source.files=[...ctx.sources];snapshot.municipalities=ctx.municipalities;
  let available=0;
  await mapLimited([...OFFICES],async office=>{
    const url=resultUrl(ctx,office);snapshot.source.files.push(url);
    try {
      const result=parseResult(await fetchOfficial(url),office,ctx.elections[office],undefined,uf);
      const normalized=normalizeResult(result,office,directory(ctx,'ft',office));
      const prior=previous?.offices[office];
      if(prior?.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<prior.updatedAt)throw new Error('Geração anterior recebida.');
      snapshot[office]=normalized.candidates;snapshot.offices[office]=normalized.meta;snapshot.partyResults![office]=normalized.parties;snapshot.statistics![office]=normalized.statistics;available++;
      if(result.dv!=='s')snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: divulgação suspensa pelo TSE.`);
    }catch{
      snapshot.stale=true;
      if(previous?.offices[office].generation){snapshot[office]=previous[office];snapshot.offices[office]={...previous.offices[office],stale:true};snapshot.partyResults![office]=previous.partyResults?.[office]||[];if(previous.statistics?.[office])snapshot.statistics![office]=previous.statistics[office];}
      snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: atualização indisponível${previous?.offices[office].generation?'; dados anteriores preservados':''}.`);
    }
  });
  const nationalUrl=`${directory(ctx,'u','president','br')}/br-c0001-e${ctx.elections.president.padStart(6,'0')}-u.jws`;
  snapshot.source.files.push(nationalUrl);
  try{
    const normalized=await getNationalPresident();
    if(!normalized.source.verifiedSignatures)throw new Error('Resultado nacional indisponível.');
    const prior=previous?.nationalPresident;
    if(prior?.meta.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<prior.meta.updatedAt)throw new Error('Geração nacional anterior recebida.');
    snapshot.nationalPresident={candidates:normalized.candidates.filter(c=>c.rank!==null).slice(0,2),meta:normalized.meta,stale:normalized.stale};
    if(normalized.stale){snapshot.stale=true;snapshot.warnings.push('Presidente no Brasil: último resultado válido preservado; atualização indisponível.');}
    available++;
    if(normalized.meta.status==='unavailable')snapshot.warnings.push('Presidente no Brasil: divulgação suspensa pelo TSE.');
  }catch{
    snapshot.stale=true;snapshot.nationalPresident=previous?.nationalPresident?{...previous.nationalPresident,stale:true}:{...snapshot.nationalPresident,stale:true};
    snapshot.warnings.push('Presidente no Brasil: atualização indisponível; último resultado válido preservado quando disponível.');
  }
  if(!available)throw new Error('Resultados oficiais indisponíveis.');
  const metas=Object.values(snapshot.offices);
  snapshot.status=metas.every(m=>m.status==='finished')?'finished':metas.some(m=>['counting','finished'].includes(m.status))?'counting':metas.some(m=>m.status==='waiting')?'waiting':'unavailable';
  const governor=snapshot.offices.governor;snapshot.progress={percentage:governor.percentage,sections:governor.sections,totalSections:governor.totalSections,office:'governor'};
  snapshot.updatedAt=metas.map(m=>m.updatedAt).filter((d):d is string=>!!d).sort().at(-1)||null;
  for(const office of ['president','governor'] as const){const list=snapshot[office];snapshot.leaders[office]=list[0]?.rank&&(!list[1]||list[0].votes>list[1].votes)?list[0]:null;}
  snapshot.leaders.senator=snapshot.senator.filter(c=>c.rank!==null).slice(0,2);
  snapshot.source.verifiedSignatures=true;snapshot.source.files.sort();return snapshot;
}
const snapshotCaches=new Map<string,SnapshotCache<ElectionSnapshot>>();
function snapshotCacheFor(uf:string){if(!snapshotCaches.has(uf))snapshotCaches.set(uf,new SnapshotCache<ElectionSnapshot>(12_000,last=>{
  const base=last||emptySnapshot(uf);return {...base,stale:true,checkedAt:new Date().toISOString(),warnings:['Não foi possível atualizar o TSE. '+(last?'Último resultado válido preservado.':'Aguardando disponibilidade da fonte oficial.')]};
}));return snapshotCaches.get(uf)!;}
const municipalCaches=new Map<string,SnapshotCache<MunicipalResult>>();
const brazilProgressCache=new SnapshotCache<BrazilProgress>(12_000,last=>({...last||emptyBrazilProgress(),stale:true,checkedAt:new Date().toISOString()}));
export async function getBrazilProgress():Promise<BrazilProgress>{
  return brazilProgressCache.get(async previous=>{const ctx=await getContext(),url=`${directory(ctx,'ab','president','br')}/br-e${ctx.elections.president.padStart(6,'0')}-ab.jws`;
    const result=parseBrazilProgress(await fetchOfficial(url),ctx.elections.president,url);
    if(previous?.updatedAt&&result.updatedAt&&result.updatedAt<previous.updatedAt)throw new Error('Geração de acompanhamento anterior.');
    return result;
  });
}
export class UnknownMunicipalityError extends Error {}
const municipalProgressCaches=new Map<string,SnapshotCache<MunicipalProgressSnapshot>>();
export async function getMunicipalProgress(uf:string):Promise<MunicipalProgressSnapshot>{
  if(!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf))throw new UnknownMunicipalityError('UF inválida.');
  if(!municipalProgressCaches.has(uf))municipalProgressCaches.set(uf,new SnapshotCache<MunicipalProgressSnapshot>(30_000,last=>({...last||{uf,municipalities:[],updatedAt:null,source:'',verifiedSignatures:false},stale:true})));
  return municipalProgressCaches.get(uf)!.get(async previous=>{
    const ctx=await getContext(uf),url=`${directory(ctx,'ab','president')}/${uf}-e${ctx.elections.president.padStart(6,'0')}-ab.jws`;
    const result=parseMunicipalProgress(await fetchOfficial(url,30_000),ctx.elections.president,uf,ctx.municipalities,url);
    if(previous?.updatedAt&&result.updatedAt&&result.updatedAt<previous.updatedAt)throw new Error('Geração municipal anterior.');
    return result;
  });
}
const municipalLeaderCaches=new Map<string,SnapshotCache<MunicipalLeader>>();
export async function getMunicipalLeaders(uf:string,codes:string[]){
  const unique=[...new Set(codes)];
  if(!unique.length||unique.length>30||unique.some(c=>!/^\d{5}$/.test(c)))throw new UnknownMunicipalityError('Selecione de 1 a 30 municípios.');
  const ctx=await getContext(uf);
  if(unique.some(c=>!ctx.municipalities.some(m=>m.code===c)))throw new UnknownMunicipalityError('Município fora da UF.');
  const municipalities=await mapLimited(unique,async code=>{
    const key=`${uf}:${code}`,municipality=ctx.municipalities.find(m=>m.code===code)!,url=resultUrl(ctx,'president',code);
    if(!municipalLeaderCaches.has(key)){if(municipalLeaderCaches.size>=500)municipalLeaderCaches.delete(municipalLeaderCaches.keys().next().value!);municipalLeaderCaches.set(key,new SnapshotCache<MunicipalLeader>(30_000,last=>last?{...last,stale:true}:{municipality,candidates:[],meta:emptyOffice(),stale:true,source:url,verifiedSignatures:false}));}
    return municipalLeaderCaches.get(key)!.get(async previous=>{
      const result=normalizeResult(parseResult(await fetchOfficial(url,30_000),'president',ctx.elections.president,code,uf),'president',directory(ctx,'ft','president'));
      if(previous?.meta.updatedAt&&result.meta.updatedAt&&result.meta.updatedAt<previous.meta.updatedAt)throw new Error('Geração de votos anterior.');
      return {municipality,candidates:result.candidates.filter(c=>c.rank!==null).slice(0,2),meta:result.meta,stale:false,source:url,verifiedSignatures:true};
    });
  });return {uf,municipalities,stale:municipalities.some(m=>m.stale),checkedAt:new Date().toISOString()};
}
export async function getElectionSnapshot(requests:MunicipalRequest[]=[],uf='sc'):Promise<ElectionSnapshot> {
  if(!BRAZIL_STATES.some(s=>s.uf.toLowerCase()===uf))throw new UnknownMunicipalityError('UF inválida.');
  const base=await snapshotCacheFor(uf).get(previous=>loadSnapshot(previous,uf));
  if(!requests.length || !base.source.verifiedSignatures)return base;
  const unique=[...new Map(requests.map(r=>[municipalKey(r),r])).values()];
  if(unique.length>30)throw new UnknownMunicipalityError('Selecione no máximo 30 combinações de cargo e município.');
  for(const r of unique)if(!OFFICES.includes(r.office)||!base.municipalities.some(m=>m.code===r.code))throw new UnknownMunicipalityError(`Cargo ou município fora de ${uf.toUpperCase()}.`);
  const ctx=await getContext(uf);
  const results=await mapLimited(unique,async r=>{
    const key=municipalKey(r),cacheKey=`${uf}:${key}`,municipality=ctx.municipalities.find(m=>m.code===r.code)!;
    if(!municipalCaches.has(cacheKey)){
      // Bound retained municipal snapshots while sharing them across visitors and candidates.
      if(municipalCaches.size>=200)municipalCaches.delete(municipalCaches.keys().next().value!);
      municipalCaches.set(cacheKey,new SnapshotCache<MunicipalResult>(12_000,last=>last?{...last,stale:true}:{municipality,office:r.office,meta:emptyOffice(),stale:true,candidateVotes:{}}));
    }
    const result=await municipalCaches.get(cacheKey)!.get(async previous=>{
      const normalized=normalizeResult(parseResult(await fetchOfficial(resultUrl(ctx,r.office,r.code)),r.office,ctx.elections[r.office],r.code,uf),r.office,directory(ctx,'ft',r.office));
      if(previous?.meta.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<previous.meta.updatedAt)throw new Error('Geração municipal anterior recebida.');
      const active=['counting','finished'].includes(normalized.meta.status);
      return {municipality,office:r.office,meta:normalized.meta,stale:false,candidateVotes:active?Object.fromEntries(normalized.candidates.map(c=>[c.id,{votes:c.votes,percentage:c.percentage}])):{}};
    });return {key,result,url:resultUrl(ctx,r.office,r.code)};
  });
  const failed=results.filter(r=>r.result.stale||r.result.meta.status==='unavailable');
  return {...base,checkedAt:new Date().toISOString(),stale:base.stale||failed.length>0,
    warnings:[...base.warnings,...(failed.length?['Parte dos resultados municipais não atualizou. Valores anteriores, quando disponíveis, foram preservados.']:[])],
    municipalResults:Object.fromEntries(results.map(r=>[r.key,r.result])),source:{...base.source,files:[...base.source.files,...results.map(r=>r.url)].sort()}};
}
