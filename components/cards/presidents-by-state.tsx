'use client';
import { BRAZIL_STATES } from '@/lib/brazil-states';
import { clock, number, percentage } from '@/lib/formatting';
import { usePresidentsByState } from '@/hooks/use-presidents-by-state';
import Avatar from './avatar';

export default function PresidentsByState(){
  const {data,error}=usePresidentsByState();
  const states=[...BRAZIL_STATES].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  return <section className="presidents-by-state" aria-labelledby="presidents-by-state-title">
    <div className="section-heading"><div><span className="section-tag">PRESIDENTE · RESULTADO POR UF</span><h2 id="presidents-by-state-title">Os dois mais votados e os votos nulos em cada estado</h2><p className="section-description muted">26 estados e Distrito Federal · votação presidencial e votos nulos na própria UF.</p></div><span className="small muted">Atualização a cada 30s</span></div>
    {(error||data?.stale)&&<p className="warning" role="status">Parte das consultas não atualizou. Os últimos resultados válidos permanecem na tela, quando disponíveis.</p>}
    <div className="state-president-grid">{states.map(state=>{
      const result=data?.states.find(s=>s.uf===state.uf),meta=result?.meta,candidates=result?.candidates||[];
      const tie=candidates.length===2&&candidates[0].votes===candidates[1].votes;
      return <article className="state-president-card panel" key={state.uf} aria-label={`Presidente em ${state.name}`}>
        <header><div><span className="section-tag">{state.uf}</span><h3>{state.name}</h3></div><div className="state-president-progress"><strong>{percentage(meta?.percentage)}</strong><span className="small muted">apurado</span></div></header>
        {candidates.length?candidates.map(c=><div className="state-president-candidate" key={c.id}><span className="state-president-rank">{c.rank}º</span><Avatar name={c.name} url={c.photoUrl}/><div className="state-president-identity"><h4>{c.name}</h4><span className="small muted">{c.party} · {c.number}</span></div><div className="state-president-votes"><strong>{percentage(c.percentage)}</strong><span className="small muted">{number(c.votes)} votos</span></div></div>):<p className="state-president-waiting small muted">{!data&&!error?'Consultando resultados da UF…':meta?.status==='waiting'?'Aguardando apuração':'Resultado da UF indisponível no momento.'}</p>}
        {tie&&<p className="small muted state-president-tie">Empate em votos · dois nomes exibidos em ordem alfabética.</p>}
        <div className="state-null-votes"><div><span>Votos nulos · Presidente</span><small>Incluindo nulos técnicos</small></div><div><strong>{number(result?.statistics?.nullVotes)}</strong><small>{result?.statistics?.nullVotesPercentage!=null?`${percentage(result.statistics.nullVotesPercentage)} dos votos computados`:'Aguardando dados de votos nulos'}</small></div></div>
        <footer className="small muted"><span>{!result?.verifiedSignatures?'Sem resultado disponível':result.stale?'Último resultado válido':meta?.status==='finished'?'Totalização final':meta?.status==='waiting'?'Aguardando apuração':'Resultado parcial'}</span><span>{meta?.updatedAt?`TSE: ${clock(meta.updatedAt)}`:'Aguardando dados TSE'}</span></footer>
      </article>;
    })}</div>
    <p className="state-president-note small muted">Liderança parcial não significa eleição. Consulta: {clock(data?.checkedAt||null)}.</p>
  </section>;
}
