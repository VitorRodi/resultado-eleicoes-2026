import { CONFIG_URL, TSE_ORIGIN, fetchOfficial } from './client';
import { configurationSchema, municipalitySchema, type TseConfiguration } from './types';
import { parseResult, parseNationalPresident } from './parser';
import { normalizeResult } from './normalize';
import { OFFICE_CONFIG } from '../../lib/config';
import { SnapshotCache } from '../../lib/cache';
import { municipalKey } from '../../lib/preferences';
import { OFFICES, type ElectionSnapshot, type Office, type OfficeMeta, type Municipality, type MunicipalRequest, type MunicipalResult } from '../../types/election';

type Context = { config:TseConfiguration; cycle:string; pleito:string; elections:Record<Office,string>; municipalities:Municipality[]; sources:string[] };
function directory(ctx:Omit<Context,'municipalities'|'sources'>,type:string,office:Office,scope:'sc'|'br'='sc'):string {
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
  return `${directory(ctx,'u',office)}/sc${municipality||''}-c${String(OFFICE_CONFIG[office].code).padStart(4,'0')}-e${ctx.elections[office].padStart(6,'0')}-u.jws`;
}
const contextCache=new SnapshotCache<Context|null>(300_000,last=>last||null);
async function getContext():Promise<Context> {
  const ctx=await contextCache.get(async()=>{
    const config=configurationSchema.parse(await fetchOfficial(CONFIG_URL,300_000));
    const pleito=config.pl.find(p=>p.dt==='04/10/2026');
    if (!pleito || pleito.c!=='ele2026') throw new Error('Pleito de 2026 não encontrado na configuração oficial.');
    const elections={} as Record<Office,string>;
    for (const office of OFFICES) {
      const election=pleito.e.find(e=>e.t==='1' && Number(e.tp)===OFFICE_CONFIG[office].type && e.abr.some(a=>['sc','br'].includes(a.cd.toLowerCase())&&a.cp.some(c=>Number(c.cd)===OFFICE_CONFIG[office].code)));
      if (!election) throw new Error(`Cargo ${office} não disponível para 2026.`);
      elections[office]=String(election.cd);
    }
    const partial={config,cycle:pleito.c,pleito:String(pleito.cd),elections};
    const url=`${directory(partial,'cm','stateDeputy')}/mun-e${elections.stateDeputy.padStart(6,'0')}-cm.jws`;
    const municipalityConfig=municipalitySchema.parse(await fetchOfficial(url,300_000));
    const sc=municipalityConfig.abr.find(a=>a.cd.toLowerCase()==='sc');
    if (!sc) throw new Error('SC ausente na configuração municipal.');
    const municipalities=sc.mu.map(m=>({name:m.nm,code:String(m.cd).padStart(5,'0')})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    if (municipalities.some(m=>!/^\d{5}$/.test(m.code)) || new Set(municipalities.map(m=>m.code)).size!==municipalities.length)
      throw new Error('Configuração municipal inválida ou duplicada.');
    return {...partial,municipalities,sources:[CONFIG_URL,url]};
  });
  if (!ctx) throw new Error('Configuração oficial indisponível.');
  return ctx;
}
const emptyOffice=():OfficeMeta=>({status:'unavailable',percentage:null,sections:null,totalSections:null,updatedAt:null,generation:null,seats:null});
export function emptySnapshot():ElectionSnapshot {
  return {status:'unavailable',updatedAt:null,checkedAt:new Date().toISOString(),stale:false,warnings:[],
    progress:{percentage:null,sections:null,totalSections:null,office:'governor'},
    president:[],governor:[],senator:[],federalDeputy:[],stateDeputy:[],leaders:{president:null,governor:null,senator:[]},nationalPresident:{candidates:[],meta:emptyOffice(),stale:false},
    offices:Object.fromEntries(OFFICES.map(o=>[o,emptyOffice()])) as Record<Office,OfficeMeta>,municipalities:[],municipalResults:{},
    source:{name:'TSE / Justiça Eleitoral',url:TSE_ORIGIN,verifiedSignatures:false,files:[CONFIG_URL]}};
}
async function mapLimited<T,R>(items:T[],fn:(item:T)=>Promise<R>,concurrency=6):Promise<R[]> {
  const output=new Array<R>(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{
    while(next<items.length){const i=next++;output[i]=await fn(items[i]);}
  }));return output;
}
async function loadSnapshot(previous:ElectionSnapshot|undefined):Promise<ElectionSnapshot> {
  const ctx=await getContext(),snapshot=emptySnapshot();snapshot.source.files=[...ctx.sources];snapshot.municipalities=ctx.municipalities;
  let available=0;
  await mapLimited([...OFFICES],async office=>{
    const url=resultUrl(ctx,office);snapshot.source.files.push(url);
    try {
      const result=parseResult(await fetchOfficial(url),office,ctx.elections[office]);
      const normalized=normalizeResult(result,office,directory(ctx,'ft',office));
      const prior=previous?.offices[office];
      if(prior?.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<prior.updatedAt)throw new Error('Geração anterior recebida.');
      snapshot[office]=normalized.candidates;snapshot.offices[office]=normalized.meta;available++;
      if(result.dv!=='s')snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: divulgação suspensa pelo TSE.`);
    }catch{
      snapshot.stale=true;
      if(previous?.offices[office].generation){snapshot[office]=previous[office];snapshot.offices[office]=previous.offices[office];}
      snapshot.warnings.push(`${OFFICE_CONFIG[office].label}: atualização indisponível${previous?.offices[office].generation?'; dados anteriores preservados':''}.`);
    }
  });
  const nationalUrl=`${directory(ctx,'u','president','br')}/br-c0001-e${ctx.elections.president.padStart(6,'0')}-u.jws`;
  snapshot.source.files.push(nationalUrl);
  try{
    const normalized=normalizeResult(parseNationalPresident(await fetchOfficial(nationalUrl),ctx.elections.president),'president',directory(ctx,'ft','president'));
    const prior=previous?.nationalPresident;
    if(prior?.meta.updatedAt&&normalized.meta.updatedAt&&normalized.meta.updatedAt<prior.meta.updatedAt)throw new Error('Geração nacional anterior recebida.');
    snapshot.nationalPresident={candidates:normalized.candidates.filter(c=>c.rank!==null).slice(0,2),meta:normalized.meta,stale:false};
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
const snapshotCache=new SnapshotCache<ElectionSnapshot>(12_000,last=>{
  const base=last||emptySnapshot();return {...base,stale:true,checkedAt:new Date().toISOString(),warnings:['Não foi possível atualizar o TSE. '+(last?'Último resultado válido preservado.':'Aguardando disponibilidade da fonte oficial.')]};
});
const municipalCaches=new Map<string,SnapshotCache<MunicipalResult>>();
export class UnknownMunicipalityError extends Error {}
export async function getElectionSnapshot(requests:MunicipalRequest[]=[]):Promise<ElectionSnapshot> {
  const base=await snapshotCache.get(loadSnapshot);
  if(!requests.length || !base.source.verifiedSignatures)return base;
  const unique=[...new Map(requests.map(r=>[municipalKey(r),r])).values()];
  if(unique.length>30)throw new UnknownMunicipalityError('Selecione no máximo 30 combinações de cargo e município.');
  for(const r of unique)if(!OFFICES.includes(r.office)||!base.municipalities.some(m=>m.code===r.code))throw new UnknownMunicipalityError('Cargo ou município fora de Santa Catarina.');
  const ctx=await getContext();
  const results=await mapLimited(unique,async r=>{
    const key=municipalKey(r),municipality=ctx.municipalities.find(m=>m.code===r.code)!;
    if(!municipalCaches.has(key)){
      // Bound retained municipal snapshots while sharing them across visitors and candidates.
      if(municipalCaches.size>=200)municipalCaches.delete(municipalCaches.keys().next().value!);
      municipalCaches.set(key,new SnapshotCache<MunicipalResult>(12_000,last=>last?{...last,stale:true}:{municipality,office:r.office,meta:emptyOffice(),stale:true,candidateVotes:{}}));
    }
    const result=await municipalCaches.get(key)!.get(async previous=>{
      const normalized=normalizeResult(parseResult(await fetchOfficial(resultUrl(ctx,r.office,r.code)),r.office,ctx.elections[r.office],r.code),r.office,directory(ctx,'ft',r.office));
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
