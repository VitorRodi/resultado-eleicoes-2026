import { canonical } from './config';
import { emptyPreferences } from './preferences';
import type { ElectionSnapshot, WatchPreferences } from '../types/election';
export const DEFAULTS_KEY='eleicoes-sc-2026:regional-defaults:v2';
export const REGIONAL_CITIES=['Cunhataí','Riqueza','Caibi','Palmitos','Águas de Chapecó','São Carlos','Planalto Alegre','Cunha Porã','Saudades'];
export function defaultWatchlist(snapshot:ElectionSnapshot):WatchPreferences|null{
  const requested=[{office:'federalDeputy' as const,name:'Daniela Reinehr',number:'2210'},{office:'stateDeputy' as const,name:'Oscar Gutz',number:'22470'},{office:'stateDeputy' as const,name:'Massocco',number:'22150'}];
  const candidates=requested.map(r=>snapshot[r.office].filter(c=>canonical(c.name)===canonical(r.name)&&c.number===r.number));
  const municipalities=REGIONAL_CITIES.map(name=>snapshot.municipalities.filter(m=>canonical(m.name)===canonical(name)));
  if(candidates.some(matches=>matches.length!==1)||municipalities.some(matches=>matches.length!==1))return null;
  const result=emptyPreferences(),codes=municipalities.map(matches=>matches[0].code);
  result.candidates=candidates.map(matches=>({office:matches[0].office,candidateId:matches[0].id}));
  result.regional=result.candidates.map(c=>({...c,municipalityCodes:[...codes]}));
  return result;
}
