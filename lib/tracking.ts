import type { Candidate, MunicipalVote, TrackedCandidate } from '../types/election';
import { canonical } from './config';
export function findCandidate(candidates: Candidate[], name: string): Candidate | null {
  const matching = candidates.filter(c => canonical(c.name) === canonical(name));
  return matching.length === 1 ? matching[0] : null;
}
export function track(candidate: Candidate | null, previous: Candidate | null, list: Candidate[]): TrackedCandidate {
  const comparable = candidate && previous && candidate.id === previous.id && candidate.rank != null && previous.rank != null;
  const above = candidate?.rank ? list.filter(c => c.votes > candidate.votes).at(-1) : null;
  return { candidate, voteDelta: comparable ? candidate.votes-previous.votes : null,
    rankDelta: comparable ? previous.rank!-candidate.rank! : null, previousRank: comparable ? previous.rank : null,
    gapAbove: candidate && above ? above.votes-candidate.votes : null };
}
export function sumRegional(rows: MunicipalVote[]): { total: number | null; available: number; largest: MunicipalVote | null } {
  const unique = [...new Map(rows.map(r => [r.code || canonical(r.name), r])).values()];
  const available = unique.filter(r => r.votes != null);
  return { total: available.length ? available.reduce((sum,r) => sum+r.votes!,0) : null,
    available: available.length, largest: available.some(r => r.votes! > 0) ? [...available].sort((a,b) => b.votes!-a.votes!)[0] : null };
}
