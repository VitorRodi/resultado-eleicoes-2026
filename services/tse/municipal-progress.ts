import {z} from 'zod';
import {parseNumber,officialTimestamp} from './parser';
import type {Municipality,OfficeMeta,Candidate} from '../../types/election';
const scalar=z.union([z.string(),z.number()]);
const schema=z.object({ele:scalar,t:z.literal('1'),f:z.literal('o'),dg:z.string(),hg:z.string(),abr:z.array(z.object({tpabr:z.enum(['uf','mun']),cdabr:z.string(),and:z.enum(['n','p','f']),s:z.object({ts:scalar,st:scalar,pst:scalar,pstn:scalar.optional()})}))});
export type MunicipalityProgress=Municipality&{sections:number|null;totalSections:number|null;percentage:number|null;status:OfficeMeta['status']};
export type MunicipalProgressSnapshot={uf:string;municipalities:MunicipalityProgress[];updatedAt:string|null;stale:boolean;source:string;verifiedSignatures:boolean};
export type MunicipalLeader={municipality:Municipality;meta:OfficeMeta;candidates:Candidate[];stale:boolean;source:string;verifiedSignatures:boolean};
export function parseMunicipalProgress(raw:unknown,election:string,uf:string,municipalities:Municipality[],source:string):MunicipalProgressSnapshot{
  const result=schema.parse(raw);
  if(String(result.ele)!==election||!result.abr.some(r=>r.tpabr==='uf'&&r.cdabr.toLowerCase()===uf)||result.abr.some(r=>r.tpabr==='uf'&&r.cdabr.toLowerCase()!==uf))throw new Error('UF ou eleição incorreta no acompanhamento municipal.');
  const entries=new Map<string,MunicipalityProgress>();
  for(const row of result.abr){
    if(row.tpabr!=='mun')continue;
    const municipality=municipalities.find(m=>m.code===row.cdabr);
    if(!municipality||entries.has(row.cdabr))throw new Error('Município fora da UF ou duplicado.');
    const sections=parseNumber(row.s.st),totalSections=parseNumber(row.s.ts),percentage=parseNumber(row.s.pstn??row.s.pst);
    if(!Number.isSafeInteger(sections)||!Number.isSafeInteger(totalSections)||sections>totalSections||percentage>100||row.and==='n'&&sections>0||row.and==='f'&&sections!==totalSections)throw new Error('Progresso municipal inválido.');
    entries.set(row.cdabr,{...municipality,sections,totalSections,percentage,status:row.and==='f'?'finished':sections===0?'waiting':'counting'});
  }
  if(!entries.size)throw new Error('Acompanhamento sem municípios.');
  return {uf,municipalities:municipalities.map(m=>entries.get(m.code)||{...m,sections:null,totalSections:null,percentage:null,status:'unavailable'}),updatedAt:officialTimestamp(result.dg,result.hg),stale:false,source,verifiedSignatures:true};
}
