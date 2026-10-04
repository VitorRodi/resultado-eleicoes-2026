import type { Candidate } from '../types/election';
export function rankCandidates(candidates: Candidate[], started: boolean): Candidate[] {
  const result = [...candidates].sort((a,b) => b.votes-a.votes || a.name.localeCompare(b.name, 'pt-BR') || a.number.localeCompare(b.number));
  // Nominal vote ranking: equal vote totals have equal ranks; no arbitrary leader on ties.
  let rank = 1;
  return result.map((candidate, i) => {
    if (i > 0 && result[i-1].votes !== candidate.votes) rank = i + 1;
    return { ...candidate, rank: started ? rank : null };
  });
}

// A nominal ranking window, not a prediction of proportional seats.
export function leadingPositions(candidates:Candidate[],seats:number|null|undefined):Candidate[] {
  if(!seats||!Number.isSafeInteger(seats)||seats<1)return [];
  return candidates.filter(c=>c.rank!==null&&c.rank<=seats).sort((a,b)=>a.rank!-b.rank!||b.votes-a.votes||a.name.localeCompare(b.name,'pt-BR'));
}
