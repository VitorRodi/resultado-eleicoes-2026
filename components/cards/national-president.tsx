'use client';
import { Globe2, Vote } from 'lucide-react';
import Avatar from './avatar';
import { clock, number, percentage } from '@/lib/formatting';
import type { ElectionSnapshot } from '@/types/election';
export default function NationalPresident({ data }: { data?:ElectionSnapshot['nationalPresident'] }) {
  const candidates=data?.candidates || [],meta=data?.meta;
  return <section className="national-panel panel" aria-labelledby="national-title">
    <div className="national-heading"><div><span className="section-tag"><Globe2 size={14} /> BRASIL · PRESIDENTE</span><h2 id="national-title">Os dois mais votados no país</h2><p className="small muted">Resultado nacional do TSE, incluindo o exterior.</p></div><div className="national-progress"><strong>{percentage(meta?.percentage)}</strong><span className="small muted">das seções totalizadas</span></div></div>
    {candidates.length?<div className="national-candidates">{candidates.map(c=><article className="national-candidate" key={c.id}><span className="national-rank">{c.rank}º</span><Avatar name={c.name} url={c.photoUrl} large /><div className="national-identity"><h3>{c.name}</h3><p className="small muted">{c.party} · {c.number}</p>{c.officialStatus && <span className="official-pill">{c.officialStatus}</span>}</div><div className="national-votes"><strong>{percentage(c.percentage)}</strong><span>{number(c.votes)} votos</span></div></article>)}</div>:<div className="national-waiting"><Vote size={25} /><div><h3>{meta?.status==='waiting'?'Aguardando totalização nacional':'Aguardando dados nacionais'}</h3><p className="small muted">Os dois mais votados aparecerão quando o TSE divulgar os primeiros votos.</p></div></div>}
    <div className="national-footer"><span>{data?.stale?'Último resultado válido · atualização indisponível':meta?.status==='finished'?'Totalização nacional final':'Votação até o momento · a ordem pode mudar'}</span><span>{meta?.updatedAt?`Dados TSE: ${clock(meta.updatedAt)}`:'Consultando a fonte nacional'}</span></div>
    {candidates.length===2 && candidates[0].votes===candidates[1].votes && <p className="small muted national-tie">Empate em votos. Até dois nomes são exibidos, em ordem alfabética entre empatados.</p>}
  </section>;
}
