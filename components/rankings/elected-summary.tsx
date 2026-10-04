'use client';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { OFFICE_CONFIG } from '@/lib/config';
import type { Candidate, Office, OfficeMeta } from '@/types/election';

export default function ElectedSummary({ office, elected, meta, filtered, onToggle }: { office:Office; elected:Candidate[]; meta?:OfficeMeta; filtered:boolean; onToggle:()=>void }) {
  const active=meta?.status==='counting'||meta?.status==='finished';
  const message=meta?.status==='unavailable'?'A confirmação de eleitos está indisponível nesta consulta.':!active?'Aguardando a totalização e a confirmação oficial do TSE.':'O TSE ainda não informou eleitos para este cargo.';
  return <aside className="elected-summary" aria-label={`Eleitos até o momento para ${OFFICE_CONFIG[office].label}`}>
    <div className="elected-heading"><ShieldCheck size={19} aria-hidden="true" /><div><h4>Eleitos até o momento</h4><span>Confirmação oficial do TSE</span></div><strong className="elected-count" aria-label={active?`${elected.length} eleitos confirmados`:'Eleitos ainda não informados'}>{active?elected.length:'—'}</strong></div>
    {active&&elected.length?<ul className="elected-names">{elected.map(c=><li key={c.id}><span><strong>{c.name}</strong><small>{c.party} · {c.number}</small></span><span className="elected-status">{c.officialStatus || 'Eleito'}</span></li>)}</ul>:<p className="elected-empty">{message}</p>}
    {active && <button className="elected-filter" onClick={onToggle} aria-pressed={filtered}>{filtered?'Ver ranking completo':'Ver só eleitos'}<ArrowUpRight size={14} aria-hidden="true" /></button>}
  </aside>;
}
