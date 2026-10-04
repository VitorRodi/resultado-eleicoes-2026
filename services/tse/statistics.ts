import type {VoteStatistics} from '../../types/election';
import type {TseResult} from './types';
import {parseNumber} from './parser';
export function normalizeStatistics(result:TseResult,visible:boolean,started:boolean):VoteStatistics{
  const count=(value:string|number|undefined,available=started)=>available&&value!==undefined?parseNumber(value):null;
  const v=result.v,e=result.e;
  const standard=count(v?.vn),technical=count(v?.vnt);
  // EA20 tvn already includes technical null votes. Never add vnt to tvn again.
  const nullVotes=count(v?.tvn)??(standard!==null&&technical!==null?standard+technical:null);
  const totalVotes=count(v?.tv);
  return {
    eligible:count(e?.te,visible),countedElectorate:count(e?.esa),
    turnout:count(e?.c),turnoutPercentage:count(e?.pcn??e?.pc),abstentions:count(e?.a),abstentionPercentage:count(e?.pan??e?.pa),
    totalVotes,validVotes:count(v?.vv),blankVotes:count(v?.vb),nullVotes,
    nullVotesPercentage:count(v?.ptvnn??v?.ptvn)??(nullVotes!==null&&totalVotes!==null&&totalVotes>0?nullVotes/totalVotes*100:null),
    technicalNullVotes:technical,annulledVotes:count(v?.van),annulledSubJudiceVotes:count(v?.vansj),noCandidateVotes:count(v?.vscv),
  };
}
