'use client';
import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck, Clock3, X } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import ShareCandidate from './share-candidate';
import { number, percentage } from '@/lib/formatting';
import { officeLabel } from '@/lib/config';
import type { TrackedCandidate, Candidate, Office, OfficeMeta } from '@/types/election';
export default function TrackedCard({ candidate, office, data, meta, onRemove, factualOnly=false,uf='sc',stateName='Santa Catarina',stale=false }: { candidate:Candidate|null; office:Office; data?: TrackedCandidate; meta?: OfficeMeta; onRemove:()=>void; factualOnly?:boolean;uf?:string;stateName?:string;stale?:boolean }) {
  const c = candidate, active = c?.rank != null;
  const delta = data?.voteDelta, movement = data?.rankDelta;
  return <article className="tracked-card panel">
    <div className="tracked-top"><span className="eyebrow">ACOMPANHAMENTO ESPECIAL</span><button className="icon-button" aria-label={`Remover ${c?.name || 'candidato'} do acompanhamento`} onClick={onRemove}><X size={17} /></button></div>
    <div className="candidate-identity"><Avatar name={c?.name || '?'} url={c?.photoUrl} large />
      <div><p className="small muted">{officeLabel(office,uf)}</p><h3>{c?.name || 'Candidatura indisponível'}</h3>
        <p className="identity-meta">{c ? <><span>{c.number}</span><span>{c.party}</span><span className="verified">Registro TSE</span></> : 'Aguardando identificação oficial'}</p></div>
    </div>
    <div className="candidate-numbers"><div><strong className="vote-number">{number(active ? c?.votes : null)}</strong><span className="small muted">votos em {stateName}</span></div>
      <div className="candidate-percentage"><strong>{percentage(active ? c?.percentage : null)}</strong><span className="small muted">dos votos a candidatos</span></div></div>
    <div className="candidate-details">{!factualOnly&&<div><span className="muted small">Posição por votos</span><div className="candidate-position-value"><strong>{active ? `${c!.rank}º` : 'Aguardando apuração'}</strong><span className="candidate-seats muted small">{meta?.seats != null && meta.seats > 0 ? `${meta.seats} ${meta.seats === 1 ? 'vaga' : 'vagas'} no cargo` : 'Vagas não informadas pelo TSE'}</span></div></div>}
      <div><span className="muted small">Situação oficial</span><strong>{c?.officialStatus || (meta?.status === 'waiting' ? 'Aguardando totalização' : 'Ainda não informada')}</strong></div></div>
    <div className={`tracked-election-status ${c?.officialElected?'is-elected':''}`}>
      {c?.officialElected?<ShieldCheck size={17}/>:<Clock3 size={17}/>}<div><strong>{c?.officialElected?'Eleito confirmado pelo TSE':!active?'Aguardando totalização':c?.officialStatus||'Eleição ainda não confirmada pelo TSE'}</strong><p>{c?.officialElected?'Confirmação oficial recebida para este candidato.':['federalDeputy','stateDeputy'].includes(office)?'A posição por votos não garante eleição no sistema proporcional.':'A confirmação depende da situação oficial publicada pelo TSE.'}</p></div>
    </div>
    <div className="delta-row"><span className={delta == null || delta === 0 ? 'muted' : delta > 0 ? 'positive' : 'negative'}>
      {delta == null ? <Minus size={15} /> : delta > 0 ? <ArrowUpRight size={16} /> : delta < 0 ? <ArrowDownRight size={16} /> : <Minus size={15} />}
      {delta == null ? 'Variação disponível após duas atualizações' : `${delta > 0 ? '+' : ''}${number(delta)} votos desde a atualização anterior`}</span>
      {!factualOnly&&movement != null && <span className={movement > 0 ? 'positive' : movement < 0 ? 'negative' : 'muted'}>{data!.previousRank}º → {c!.rank}º {movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : '· estável'}</span>}
    </div>
    {!factualOnly&&data?.gapAbove != null && <p className="gap small muted">Diferença para a posição acima: {number(data.gapAbove)} votos.</p>}
    {c&&<ShareCandidate candidate={c} meta={meta} uf={uf} stateName={stateName} stale={stale}/>}
  </article>;
}
