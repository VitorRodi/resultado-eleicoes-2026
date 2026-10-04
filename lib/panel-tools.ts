import { canonical, officeLabel } from './config';
import { municipalKey, selectionKey } from './preferences';
import type { Candidate, CandidateSelection, ElectionSnapshot, Office, PartyResult, WatchPreferences } from '../types/election';

export function matchesCandidate(candidate:Candidate, query:string):boolean {
  const text=canonical(`${candidate.name} ${candidate.fullName} ${candidate.number} ${candidate.party} ${candidate.federation||''}`);
  return canonical(query).split(' ').filter(Boolean).every(word=>text.includes(word));
}
export function watchedCandidates(snapshot:ElectionSnapshot|null, preferences:WatchPreferences):Candidate[]{
  const selections=[...new Map([...preferences.candidates,...preferences.regional].map(s=>[selectionKey(s),s])).values()];
  return selections.flatMap(s=>snapshot?.[s.office].find(c=>c.id===s.candidateId)||[]);
}
export function municipalPosition(votes:Record<string,{votes:number}>,id:string):number|null {
  const candidate=votes[id];
  return candidate?1+Object.values(votes).filter(c=>c.votes>candidate.votes).length:null;
}
export type HistoryPoint={at:string; generation:string; votes:number; percentage:number; rank:number};
export type CandidateHistory=Record<string,HistoryPoint[]>;
const HISTORY_LIMIT=240;
export function parseHistory(value:unknown):CandidateHistory {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result:CandidateHistory={};
  for(const [key,points] of Object.entries(value).slice(0,100)){
    if(!/^(president|governor|senator|federalDeputy|stateDeputy):\d+$/.test(key)||!Array.isArray(points))continue;
    result[key]=points.filter((p):p is HistoryPoint=>!!p&&typeof p.at==='string'&&Number.isFinite(Date.parse(p.at))&&typeof p.generation==='string'&&Number.isSafeInteger(p.votes)&&p.votes>=0&&Number.isFinite(p.percentage)&&p.percentage>=0&&p.percentage<=100&&Number.isSafeInteger(p.rank)&&p.rank>0).sort((a,b)=>a.at.localeCompare(b.at)).slice(-HISTORY_LIMIT);
  }
  return result;
}
export function recordHistory(history:CandidateHistory, snapshot:ElectionSnapshot, candidates:Candidate[]):CandidateHistory {
  if(!snapshot.source.verifiedSignatures)return history;
  let next=history;
  for(const c of candidates){
    const meta=snapshot.offices[c.office];
    if(c.rank===null||!meta.updatedAt||!meta.generation||!['counting','finished'].includes(meta.status))continue;
    const key=selectionKey({office:c.office,candidateId:c.id}),points=history[key]||[],last=points.at(-1);
    if(last&&(last.at>meta.updatedAt||last.generation===meta.generation))continue;
    const point={at:meta.updatedAt,generation:meta.generation,votes:c.votes,percentage:c.percentage,rank:c.rank};
    if(next===history)next={...history};
    // A corrected result at the same official time replaces that sample, without inventing an extra interval.
    next[key]=[...points.filter(p=>p.at!==point.at),point].slice(-HISTORY_LIMIT);
  }
  return Object.keys(next).length>100?Object.fromEntries(Object.entries(next).sort((a,b)=>(b[1].at(-1)?.at||'').localeCompare(a[1].at(-1)?.at||'')).slice(0,100)):next;
}
export function groupParties(parties:PartyResult[], federations:boolean):PartyResult[]{
  const groups=new Map<string,PartyResult>();
  for(const party of parties){
    const key=federations&&party.federation?party.federation:party.id,prior=groups.get(key);
    if(!prior)groups.set(key,{...party,id:key,label:party.label,electedIds:[...party.electedIds]});
    else groups.set(key,{...prior,label:`${prior.label} / ${party.label}`,nominalVotes:prior.nominalVotes===null||party.nominalVotes===null?null:prior.nominalVotes+party.nominalVotes,legendVotes:prior.legendVotes===null||party.legendVotes===null?null:prior.legendVotes+party.legendVotes,electedIds:[...new Set([...prior.electedIds,...party.electedIds])]});
  }
  const total=(p:PartyResult)=>p.nominalVotes===null||p.legendVotes===null?-1:p.nominalVotes+p.legendVotes;
  return [...groups.values()].sort((a,b)=>total(b)-total(a)||a.label.localeCompare(b.label,'pt-BR'));
}
export function csvCell(value:unknown):string {
  let text=value==null?'':String(value);
  // Spreadsheet applications must treat names and statuses as text, never formulas.
  if(/^[\s]*[=+@-]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export function selectedResultsCsv(snapshot:ElectionSnapshot,preferences:WatchPreferences,office:Office|'all'='all'):string {
  const records:unknown[][]=[['UF','Abrangência','Município','Cargo','Candidato','Número','Partido','Votos','Percentual do candidato','Posição por votos','Vagas no cargo','Situação oficial','Seções totalizadas (%)','Dados TSE (Brasília)','Consulta (Brasília)','Fonte / condição']];
  const date=(value:string|null)=>value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(value)):'';
  const selections=[...new Map([...preferences.candidates,...preferences.regional].filter(s=>office==='all'||s.office===office).map(s=>[selectionKey(s),s])).values()];
  for(const s of selections){
    const c=snapshot[s.office].find(c=>c.id===s.candidateId),meta=snapshot.offices[s.office];
    if(!c)continue;
    records.push([snapshot.state.uf.toUpperCase(),'Estado','',officeLabel(s.office,snapshot.state.uf),c.name,c.number,c.party,c.rank===null?null:c.votes,c.rank===null?null:c.percentage,c.rank,meta.seats,c.officialStatus,meta.percentage,date(meta.updatedAt),date(snapshot.checkedAt),snapshot.stale?'Último resultado válido / consulta com aviso':'TSE']);
    const regional=preferences.regional.find(r=>selectionKey(r)===selectionKey(s));
    for(const code of regional?.municipalityCodes||[]){
      const result=snapshot.municipalResults[municipalKey({office:s.office,code})],active=result&&['counting','finished'].includes(result.meta.status),vote=active?result.candidateVotes[c.id]:undefined;
      records.push([snapshot.state.uf.toUpperCase(),'Município',result?.municipality.name||snapshot.municipalities.find(m=>m.code===code)?.name||code,officeLabel(s.office,snapshot.state.uf),c.name,c.number,c.party,vote?.votes,vote?.percentage,active?municipalPosition(result.candidateVotes,c.id):null,null,'',result?.meta.percentage,date(result?.meta.updatedAt||null),date(snapshot.checkedAt),!vote?'Resultado indisponível':result?.stale?'Último resultado válido':'TSE']);
    }
  }
  return '\uFEFF'+records.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
export const candidateSelection=(c:Candidate):CandidateSelection=>({office:c.office,candidateId:c.id});
