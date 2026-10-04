'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { MapPin } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import { MUNICIPALITIES, TRACKED } from '@/lib/config';
import { number, percentage } from '@/lib/formatting';
import { sumRegional } from '@/lib/tracking';
import type { Candidate, MunicipalVote, TrackedKey } from '@/types/election';
export default function RegionalChart({ trackKey, rows, candidate }: { trackKey: TrackedKey; rows?: MunicipalVote[]; candidate?: Candidate | null }) {
  const data: MunicipalVote[] = rows || MUNICIPALITIES.map(name => ({ name, code:null,votes:null,percentage:null,status:'waiting',updatedAt:null }));
  const sorted = [...data].sort((a,b) => (b.votes ?? -1)-(a.votes ?? -1));
  const aggregate = sumRegional(data);
  const chartData = sorted.filter(r => r.votes != null).map(r => ({ ...r, municipality: r.name }));
  return <article className="regional-card panel">
    <div className="regional-head"><Avatar name={TRACKED[trackKey].name} url={candidate?.photoUrl} /><div><h3>{TRACKED[trackKey].name}</h3><p className="small muted">Votos por município</p></div><MapPin size={19} className="muted" aria-hidden="true" /></div>
    <div className="regional-total"><strong>{number(aggregate.total)}</strong><span className="muted small">votos nos 9 municípios{aggregate.available > 0 && aggregate.available < 9 ? ` · parcial (${aggregate.available}/9)` : ''}</span></div>
    {aggregate.largest && <p className="largest small">Maior votação: <strong>{aggregate.largest.name}</strong> · {number(aggregate.largest.votes)} votos</p>}
    {chartData.length > 0 && <div className="chart" role="img" aria-label={`Gráfico de votos de ${TRACKED[trackKey].name} por município`}>
      <ResponsiveContainer width="100%" height={Math.max(96, chartData.length * 43)} minWidth={0}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 46, top: 8, bottom: 8 }}>
          <XAxis type="number" hide domain={[0,'dataMax']} /><YAxis type="category" dataKey="municipality" width={158} axisLine={false} tickLine={false} tick={{ fill:'#b8c6d8', fontSize:12 }} />
          <Tooltip cursor={{ fill:'#1b293a' }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.name}</strong><p>{number(payload[0].payload.votes)} votos</p><p>{percentage(payload[0].payload.percentage)} totalizado</p></div> : null} />
          <Bar dataKey="votes" fill="#80b9ee" radius={[0,3,3,0]} barSize={12} isAnimationActive={false}><LabelList dataKey="votes" position="right" fill="#edf3fa" fontSize={12} formatter={v => number(Number(v))} /></Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>}
    <div className={`municipal-list ${chartData.length ? 'compact-municipal' : ''}`}>
      {sorted.map(row => <div className="municipal-row" key={row.name}><span className="municipal-name">{row.name}</span><span className="municipal-value">{row.votes == null ? <span className={row.status === 'unavailable' ? 'warning-text' : 'muted'}>{row.status === 'unavailable' ? 'Fonte indisponível' : 'Aguardando totalização'}</span> : <><strong>{number(row.votes)}</strong><span className="muted"> votos · {percentage(row.percentage)} totalizado</span></>}</span></div>)}
    </div><p className="regional-foot small muted">Totalização indicada por município. A soma regional pode incluir apurações parciais.</p>
  </article>;
}
