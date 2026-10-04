import type { StatePresidentResult, Candidate } from '../types/election';
export const PRESIDENTIAL_MAP_COLORS={lula:'#d74e5a',flavio:'#357ddd',tie:'#5e6b7b',other:'#ad9354',unavailable:'#232e3b'};
type MapTone={kind:keyof typeof PRESIDENTIAL_MAP_COLORS;color:string;label:string;leader:Candidate|null};
export function presidentialMapTone(result:StatePresidentResult|undefined):MapTone{
  const tone=(kind:MapTone['kind'],label:string,leader:Candidate|null=null)=>({kind,color:PRESIDENTIAL_MAP_COLORS[kind],label,leader});
  if(!result?.verifiedSignatures||!['counting','finished'].includes(result.meta.status))return tone('unavailable','Sem liderança disponível');
  const candidates=[...result.candidates].filter(c=>c.rank!==null).sort((a,b)=>b.votes-a.votes),first=candidates[0];
  if(!first||first.votes<=0)return tone('unavailable','Sem liderança disponível');
  if(candidates[1]?.votes===first.votes)return tone('tie','Empate na liderança');
  if(first.number==='13'&&first.party==='PT')return tone('lula','Lula lidera por votos',first);
  if(first.number==='22'&&first.party==='PL')return tone('flavio','Flávio Bolsonaro lidera por votos',first);
  return tone('other',`${first.name} lidera por votos`,first);
}
