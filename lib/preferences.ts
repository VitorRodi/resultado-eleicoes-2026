import { z } from 'zod';
import { OFFICES, type CandidateSelection, type ElectionSnapshot, type MunicipalRequest, type MunicipalVote, type RegionalSelection, type WatchPreferences } from '../types/election';
export const STORAGE_KEY = 'eleicoes-sc-2026:preferences:v1';
export const MAX_MUNICIPAL_REQUESTS = 30;
const candidateSchema = z.object({ candidateId:z.string().regex(/^\d+$/), office:z.enum(OFFICES) });
const regionalSchema = candidateSchema.extend({ municipalityCodes:z.array(z.string().regex(/^\d{5}$/)).max(30) });
export const preferencesSchema = z.object({ version:z.literal(1), candidates:z.array(candidateSchema).max(50), regional:z.array(regionalSchema).max(50) });
export const emptyPreferences = (): WatchPreferences => ({ version:1,candidates:[],regional:[] });
export const selectionKey = (s:CandidateSelection) => `${s.office}:${s.candidateId}`;
export const municipalKey = (s:MunicipalRequest) => `${s.office}:${s.code}`;
export function municipalRequests(selections:RegionalSelection[]): MunicipalRequest[] {
  return [...new Map(selections.flatMap(s=>s.municipalityCodes.map(code=>({office:s.office,code}))).map(s=>[municipalKey(s),s])).values()].sort((a,b)=>municipalKey(a).localeCompare(municipalKey(b)));
}
export function applyRegionalSelections(current:RegionalSelection[], additions:RegionalSelection[], appendCities=false):RegionalSelection[]{
  const additionsWithCities=additions.map(s=>({...s,municipalityCodes:appendCities?[...(current.find(c=>selectionKey(c)===selectionKey(s))?.municipalityCodes||[]),...s.municipalityCodes]:s.municipalityCodes}));
  const combined=[...new Map([...current,...additionsWithCities].map(s=>[selectionKey(s),{...s,municipalityCodes:[...new Set(s.municipalityCodes)]}])).values()];
  if(combined.length>50)throw new Error('Seu painel permite até 50 candidatos por município. Remova um acompanhamento para continuar.');
  if(municipalRequests(combined).length>MAX_MUNICIPAL_REQUESTS)throw new Error('Seu painel permite até 30 combinações de cargo e cidade. Remova algumas cidades para continuar.');
  return combined;
}
export function parsePreferences(value:unknown): WatchPreferences {
  const parsed = preferencesSchema.safeParse(value);
  if (!parsed.success) return emptyPreferences();
  const result:WatchPreferences = { version:1,
    candidates:[...new Map(parsed.data.candidates.map(s=>[selectionKey(s),s])).values()],
    regional:[...new Map(parsed.data.regional.map(s=>[selectionKey(s),{...s,municipalityCodes:[...new Set(s.municipalityCodes)]}])).values()],
  };
  return municipalRequests(result.regional).length <= MAX_MUNICIPAL_REQUESTS ? result : emptyPreferences();
}
export function parseRegionalQuery(query:string|null): MunicipalRequest[] {
  if (!query) return [];
  const parts=query.split(',');
  if (parts.length>MAX_MUNICIPAL_REQUESTS) throw new Error('Selecione no máximo 30 combinações de cargo e município.');
  const schema=z.object({office:z.enum(OFFICES),code:z.string().regex(/^\d{5}$/)});
  return [...new Map(parts.map(part=>{
    const [office,code,...extra]=part.split(':');
    if (extra.length) throw new Error('Consulta municipal inválida.');
    const parsed=schema.safeParse({office,code});
    if (!parsed.success) throw new Error('Consulta municipal inválida.');
    return [municipalKey(parsed.data),parsed.data] as const;
  })).values()];
}
export function regionalRows(selection:RegionalSelection, snapshot:ElectionSnapshot|null): MunicipalVote[] {
  return [...new Set(selection.municipalityCodes)].map(code=>{
    const result=snapshot?.municipalResults[municipalKey({office:selection.office,code})];
    const vote=result?.candidateVotes[selection.candidateId];
    const active=result && ['counting','finished'].includes(result.meta.status);
    return {name:result?.municipality.name || snapshot?.municipalities.find(m=>m.code===code)?.name || `Município ${code}`,
      code,votes:active && vote ? vote.votes : null,percentage:result?.meta.percentage ?? null,
      status:active && !vote ? 'unavailable' : result?.meta.status || 'waiting',updatedAt:result?.meta.updatedAt || null};
  });
}
