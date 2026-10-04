import type { Candidate, Office, OfficeMeta } from '../../types/election';
import type { TseResult } from './types';
import { parseNumber, officialTimestamp } from './parser';
import { rankCandidates } from '../../lib/ranking';
import { officialPhoto } from './photos';
import { electedByTse } from '../../lib/elected';

export function normalizeResult(result: TseResult, office: Office, photoDirectory: string): { candidates: Candidate[]; meta: OfficeMeta } {
  const visible = result.dv === 's';
  const started = visible && parseNumber(result.s.st) > 0 && result.and !== 'n';
  const candidates: Candidate[] = [];
  // A disclosure suspension must never reveal newly delivered vote data.
  if (visible) for (const group of result.carg[0].agr) for (const party of group.par) for (const c of party.cand) {
    candidates.push({
      id: String(c.sqcand), name: c.nmu || c.nm, fullName: c.nm, number: String(c.n), party: party.sg, office,
      votes: started ? parseNumber(c.vap) : 0, percentage: started ? parseNumber(c.pvapn ?? c.pvap) : 0,
      rank: null, officialStatus: c.st || null, officialElected: started && electedByTse(office,c.e === 's',c.st || null,result.md),
      photoUrl: officialPhoto(photoDirectory, String(c.sqcand)), destination: c.dvt || null,
    });
  }
  return {
    candidates: rankCandidates(candidates, started),
    meta: {
      status: !visible ? 'unavailable' : !started ? 'waiting' : result.tf === 's' && result.and === 'f' ? 'finished' : 'counting',
      percentage: visible ? parseNumber(result.s.pstn ?? result.s.pst) : null,
      sections: visible ? parseNumber(result.s.st) : null, totalSections: visible ? parseNumber(result.s.ts) : null,
      updatedAt: officialTimestamp(result.dt, result.ht) || officialTimestamp(result.dg, result.hg),
      generation: String(result.idg), seats: parseNumber(result.carg[0].nv),
    },
  };
}
