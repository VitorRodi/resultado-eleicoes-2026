import { z } from 'zod';
import { BRAZIL_STATES } from '../../lib/brazil-states';
import { parseNumber, officialTimestamp } from './parser';
const scalar=z.union([z.string(),z.number()]);
const schema=z.object({ele:scalar,t:z.literal('1'),f:z.literal('o'),dg:z.string(),hg:z.string(),idg:scalar,abr:z.array(z.object({tpabr:z.enum(['br','uf']),cdabr:z.string(),and:z.enum(['n','p','f']),dt:z.string(),ht:z.string(),s:z.object({ts:scalar,st:scalar,pst:scalar,pstn:scalar.optional()})}))});
export type StateProgress={uf:string;name:string;percentage:number|null;sections:number|null;totalSections:number|null;status:'waiting'|'counting'|'finished'|'unavailable'};
export type BrazilProgress={states:StateProgress[];updatedAt:string|null;stale:boolean;source:string;checkedAt:string};
export function emptyBrazilProgress():BrazilProgress{return {states:BRAZIL_STATES.map(s=>({uf:s.uf,name:s.name,percentage:null,sections:null,totalSections:null,status:'unavailable'})),updatedAt:null,stale:true,source:'',checkedAt:new Date().toISOString()};}
export function parseBrazilProgress(raw:unknown,election:string,source:string):BrazilProgress{
  const result=schema.parse(raw);
  if(String(result.ele)!==election)throw new Error('Eleição presidencial incorreta no acompanhamento Brasil.');
  const seen=new Set<string>();
  const entries=new Map<string,StateProgress>();
  for(const row of result.abr){
    if(row.tpabr!=='uf'||row.cdabr.toUpperCase()==='ZZ')continue;
    const uf=row.cdabr.toUpperCase(),state=BRAZIL_STATES.find(s=>s.uf===uf);
    if(!state||seen.has(uf))throw new Error('UF inválida ou duplicada.');
    seen.add(uf);
    const sections=parseNumber(row.s.st),totalSections=parseNumber(row.s.ts),percentage=parseNumber(row.s.pstn??row.s.pst);
    if(!Number.isSafeInteger(sections)||!Number.isSafeInteger(totalSections)||sections>totalSections||percentage>100||(row.and==='n'&&sections>0)||(row.and==='f'&&sections!==totalSections))throw new Error('Progresso de UF inválido.');
    entries.set(uf,{uf,name:state.name,sections,totalSections,percentage,status:row.and==='f'?'finished':row.and==='n'||sections===0?'waiting':'counting'});
  }
  if(!entries.size)throw new Error('Acompanhamento sem UFs.');
  return {...emptyBrazilProgress(),states:BRAZIL_STATES.map(s=>entries.get(s.uf)??{uf:s.uf,name:s.name,percentage:null,sections:null,totalSections:null,status:'unavailable'}),updatedAt:officialTimestamp(result.dg,result.hg),stale:false,source};
}
