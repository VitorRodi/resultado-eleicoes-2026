'use client';
import { useState } from 'react';
import { Search } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import ElectedSummary from './elected-summary';
import { confirmedElected } from '@/lib/elected';
import { officeLabel, canonical } from '@/lib/config';
import { number, percentage, clock } from '@/lib/formatting';
import type { Candidate, Office, OfficeMeta } from '@/types/election';
export default function Ranking({ office, candidates = [], meta, highlightedIds = [],uf='sc',stateName='Santa Catarina' }: { uf?:string;stateName?:string;office: Office; candidates?: Candidate[]; meta?: OfficeMeta; highlightedIds?:string[] }) {
  const [query,setQuery] = useState(''), [expanded,setExpanded] = useState(false);
  const [electedOnly,setElectedOnly]=useState(false);
  const deputy = ['federalDeputy','stateDeputy'].includes(office), limit = office === 'federalDeputy' ? 20 : deputy ? 30 : 100;
  const elected=confirmedElected(candidates);
  const filtered = (electedOnly?elected:candidates).filter(c => canonical(c.name).includes(canonical(query)) || canonical(c.fullName).includes(canonical(query)) || c.number.includes(query.trim()));
  const rows = expanded || query || electedOnly ? filtered : filtered.slice(0,limit);
  const active = meta?.status === 'counting' || meta?.status === 'finished';
  return <article className={`ranking panel ${deputy ? 'deputy-ranking' : ''}`} id={office}>
    <div className="ranking-title"><div><span className="eyebrow">{stateName.toUpperCase()}</span><h3>{officeLabel(office,uf)}</h3></div><span className="small muted">{meta?.percentage != null ? `${percentage(meta.percentage)} totalizado` : 'Aguardando dados'}</span></div>
    {office==='governor' && <ElectedSummary office={office} elected={elected} meta={meta} filtered={electedOnly} onToggle={()=>setElectedOnly(v=>!v)} />}
    {deputy && <label className="search"><Search size={17} aria-hidden="true" /><input aria-label={`Buscar ${officeLabel(office,uf)} por nome ou número`} placeholder="Buscar por nome ou número" value={query} onChange={e => setQuery(e.target.value)} /></label>}
    {!active && <div className="ranking-notice">{meta?.status === 'unavailable' ? 'Dados oficiais temporariamente indisponíveis.' : 'Aguardando início da totalização.'}{candidates.length > 0 && <span> Candidaturas confirmadas pelo TSE.</span>}</div>}
    {active && <div className="ranking-columns" aria-hidden="true"><span>CANDIDATO</span><span>VOTOS / %</span></div>}
    {rows.map(c => <div className={`ranking-row ${highlightedIds.includes(c.id) ? 'tracked-ranking-row' : ''}`} key={c.id}>
      <span className="rank-position">{c.rank != null ? `${c.rank}º` : '—'}</span><Avatar name={c.name} url={c.photoUrl} />
      <div className="rank-name"><strong>{c.name}</strong><span className="small muted">{c.party} · {c.number}{c.officialStatus ? <span className="official-status"> · {c.officialStatus}</span> : ''}</span>{c.destination && c.destination !== 'Válido' && <span className="small warning-text">{c.destination}</span>}</div>
      <div className="rank-votes"><strong>{number(active ? c.votes : null)}</strong><span className="small muted">{percentage(active ? c.percentage : null)}</span></div>
      {active && <div className="vote-track"><span style={{ width:`${c.percentage}%` }} /></div>}
    </div>)}
    {!rows.length && <p className="ranking-empty muted">{query ? 'Nenhum candidato encontrado.' : electedOnly?'Nenhum eleito confirmado pelo TSE para este cargo.':'O ranking aparecerá quando os dados oficiais estiverem disponíveis.'}</p>}
    {!query && !electedOnly && filtered.length > limit && <button className="show-more" onClick={() => setExpanded(v => !v)}>{expanded ? `Mostrar top ${limit}` : `Ver todos os ${candidates.length} candidatos`}</button>}
    {meta?.updatedAt && <p className="ranking-updated small muted">Dados TSE: {new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(meta.updatedAt))} às {clock(meta.updatedAt)}</p>}
  </article>;
}
