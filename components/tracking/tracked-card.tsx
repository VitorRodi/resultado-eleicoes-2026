'use client';
import { ArrowDownRight, ArrowUpRight, Minus, ScanFace } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import { number, percentage } from '@/lib/formatting';
import { TRACKED } from '@/lib/config';
import type { TrackedCandidate, TrackedKey, OfficeMeta } from '@/types/election';
export default function TrackedCard({ trackKey, data, meta }: { trackKey: TrackedKey; data?: TrackedCandidate; meta?: OfficeMeta }) {
  const c = data?.candidate, active = c?.rank != null;
  const delta = data?.voteDelta, movement = data?.rankDelta;
  return <article className="tracked-card panel">
    <div className="tracked-top"><span className="eyebrow">ACOMPANHAMENTO ESPECIAL</span><ScanFace size={19} aria-hidden="true" /></div>
    <div className="candidate-identity"><Avatar name={TRACKED[trackKey].name} url={c?.photoUrl} large />
      <div><p className="small muted">{trackKey === 'danielaReinehr' ? 'Deputada federal' : 'Deputado estadual'}</p><h3>{TRACKED[trackKey].name}</h3>
        <p className="identity-meta">{c ? <><span>{c.number}</span><span>{c.party}</span><span className="verified">Registro TSE</span></> : 'Aguardando identificação oficial'}</p></div>
    </div>
    <div className="candidate-numbers"><div><strong className="vote-number">{number(active ? c?.votes : null)}</strong><span className="small muted">votos em Santa Catarina</span></div>
      <div className="candidate-percentage"><strong>{percentage(active ? c?.percentage : null)}</strong><span className="small muted">dos votos a candidatos</span></div></div>
    <div className="candidate-details"><div><span className="muted small">Posição por votos</span><strong>{active ? `${c!.rank}º` : 'Aguardando apuração'}</strong></div>
      <div><span className="muted small">Situação oficial</span><strong>{c?.officialStatus || (meta?.status === 'waiting' ? 'Aguardando totalização' : 'Ainda não informada')}</strong></div></div>
    <div className="delta-row"><span className={delta == null || delta === 0 ? 'muted' : delta > 0 ? 'positive' : 'negative'}>
      {delta == null ? <Minus size={15} /> : delta > 0 ? <ArrowUpRight size={16} /> : delta < 0 ? <ArrowDownRight size={16} /> : <Minus size={15} />}
      {delta == null ? 'Variação disponível após duas atualizações' : `${delta > 0 ? '+' : ''}${number(delta)} votos desde a atualização anterior`}</span>
      {movement != null && <span className={movement > 0 ? 'positive' : movement < 0 ? 'negative' : 'muted'}>{data!.previousRank}º → {c!.rank}º {movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : '· estável'}</span>}
    </div>
    {data?.gapAbove != null && <p className="gap small muted">Diferença para a posição acima: {number(data.gapAbove)} votos.</p>}
  </article>;
}
