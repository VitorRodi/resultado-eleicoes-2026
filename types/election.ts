export const OFFICES = ['president', 'governor', 'senator', 'federalDeputy', 'stateDeputy'] as const;
export type Office = typeof OFFICES[number];
export type Candidate = {
  id: string; name: string; fullName: string; number: string; party: string;
  office: Office; votes: number; percentage: number; rank: number | null;
  officialStatus: string | null; officialElected: boolean; photoUrl: string | null;
  destination: string | null;
  federation?: string | null;
};
export type PartyResult = {
  id:string; name:string; label:string; federation:string|null;
  nominalVotes:number|null; legendVotes:number|null; electedIds:string[];
};
export type VoteStatistics={
  eligible:number|null; countedElectorate:number|null;
  turnout:number|null; turnoutPercentage:number|null; abstentions:number|null; abstentionPercentage:number|null;
  totalVotes:number|null; validVotes:number|null; blankVotes:number|null;
  nullVotes:number|null; nullVotesPercentage:number|null; technicalNullVotes:number|null;
  annulledVotes:number|null; annulledSubJudiceVotes:number|null; noCandidateVotes:number|null;
};
export type OfficeMeta = {
  status: 'waiting' | 'counting' | 'finished' | 'unavailable';
  percentage: number | null; sections: number | null; totalSections: number | null;
  updatedAt: string | null; generation: string | null; seats: number | null;
};
export type TrackedCandidate = {
  candidate: Candidate | null; voteDelta: number | null; rankDelta: number | null;
  previousRank: number | null; gapAbove: number | null;
};
export type MunicipalVote = {
  name: string; code: string | null; votes: number | null; percentage: number | null;
  status: 'waiting' | 'counting' | 'finished' | 'unavailable'; updatedAt: string | null;
};
export type Municipality = { name: string; code: string };
export type CandidateSelection = { candidateId: string; office: Office };
export type RegionalSelection = CandidateSelection & { municipalityCodes: string[] };
export type WatchPreferences = { version: 1; candidates: CandidateSelection[]; regional: RegionalSelection[] };
export type MunicipalRequest = { office: Office; code: string };
export type MunicipalResult = {
  municipality: Municipality; office: Office; meta: OfficeMeta; stale: boolean;
  candidateVotes: Record<string, { votes: number; percentage: number }>;
};
export type NationalPresidentSnapshot = {
  candidates: Candidate[]; meta: OfficeMeta; stale: boolean; checkedAt: string;
  statistics?:VoteStatistics;
  source: { verifiedSignatures: boolean; files: string[] };
};
export type StatePresidentResult = {
  uf: string; name: string; candidates: Candidate[]; meta: OfficeMeta;
  statistics?:VoteStatistics;
  stale: boolean; verifiedSignatures: boolean; source: string;
};
export type PresidentsByStateSnapshot = {
  states: StatePresidentResult[]; stale: boolean; checkedAt: string;
};
export type ElectionSnapshot = {
  state:{uf:string;name:string};
  status: 'waiting' | 'counting' | 'finished' | 'unavailable';
  updatedAt: string | null; checkedAt: string; stale: boolean; warnings: string[];
  progress: { percentage: number | null; sections: number | null; totalSections: number | null; office: 'governor' };
  leaders: { president: Candidate | null; governor: Candidate | null; senator: Candidate[] };
  nationalPresident: { candidates: Candidate[]; meta: OfficeMeta; stale: boolean };
  president: Candidate[]; governor: Candidate[]; senator: Candidate[];
  federalDeputy: Candidate[]; stateDeputy: Candidate[];
  offices: Record<Office, OfficeMeta>;
  partyResults?: Partial<Record<Office, PartyResult[]>>;
  statistics?: Partial<Record<Office, VoteStatistics>>;
  municipalities: Municipality[];
  municipalResults: Record<string, MunicipalResult>;
  source: { name: string; url: string; verifiedSignatures: boolean; files: string[] };
};
