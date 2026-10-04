import { resultSchema, type TseResult } from './types';
import type { Office } from '../../types/election';
import { officeCode } from '../../lib/config';

export function parseNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error('Número inválido no arquivo oficial.');
  return n;
}
export function parseResult(raw: unknown, office: Office, election: string, municipality?: string,uf='sc'): TseResult {
  return validateResult(raw,office,election,municipality?'mu':'uf',municipality||uf,uf);
}
export function parseNationalPresident(raw:unknown,election:string):TseResult {
  return validateResult(raw,'president',election,'br','br');
}
function validateResult(raw:unknown,office:Office,election:string,scope:string,code:string,uf='sc'):TseResult {
  const result = resultSchema.parse(raw);
  if (String(result.ele) !== election || result.t !== '1') throw new Error('Eleição ou turno incorreto.');
  if (result.tpabr !== scope || result.cdabr.toLowerCase() !== code)
    throw new Error('Abrangência incorreta.');
  if (result.carg.length !== 1 || Number(result.carg[0].cd) !== officeCode(office,uf))
    throw new Error('Cargo incorreto.');
  const sections = parseNumber(result.s.st), total = parseNumber(result.s.ts);
  const progress = parseNumber(result.s.pstn ?? result.s.pst);
  if (sections > total || progress > 100) throw new Error('Progresso inválido.');
  const ids = new Set<string>();
  for (const aggregate of result.carg[0].agr) for (const party of aggregate.par) for (const candidate of party.cand) {
    if (!/^\d+$/.test(String(candidate.sqcand)) || ids.has(String(candidate.sqcand))) throw new Error('Identificador duplicado ou inválido.');
    ids.add(String(candidate.sqcand));
    if (!Number.isSafeInteger(parseNumber(candidate.vap)) || parseNumber(candidate.pvapn ?? candidate.pvap) > 100)
      throw new Error('Votação inválida.');
  }
  return result;
}
export function officialTimestamp(date: string, time: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) return null;
  const [day,month,year] = date.split('/');
  const parsed = new Date(`${year}-${month}-${day}T${time}-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
