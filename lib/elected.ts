import { canonical } from './config';
import type { Candidate, Office } from '../types/election';

// EA20: e='s' also marks a second-round candidate for president/governor.
export function electedByTse(office:Office,flag:boolean,status:string|null,definition?:'e'|'s'|'n'):boolean {
  const situation=canonical(status || '');
  if(situation && !['eleito','eleito por qp','eleito por media'].includes(situation))return false;
  if(!flag)return false;
  return office==='president'||office==='governor' ? !!situation || definition==='e' : true;
}

export function confirmedElected(candidates:Candidate[]):Candidate[] {
  return candidates.filter(c=>c.officialElected && c.rank!==null);
}
