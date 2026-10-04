'use client';
import { useState } from 'react';
import { ListOrdered, ShieldCheck, Vote } from 'lucide-react';
import Avatar from './avatar';
import { leadingPositions } from '@/lib/ranking';
import { confirmedElected } from '@/lib/elected';
import { clock, number, percentage } from '@/lib/formatting';
import type { Candidate, OfficeMeta } from '@/types/election';
type PositionOffice='senator'|'federalDeputy'|'stateDeputy';
const titles:Record<PositionOffice,string>={senator:'Senado',federalDeputy:'Deputados federais',stateDeputy:'Deputados estaduais'};
export default function PositionPanel({ office, candidates=[], meta }: { office:PositionOffice; candidates?:Candidate[]; meta?:OfficeMeta }) {
  const [electedOnly,setElectedOnly]=useState(false);
  const active=meta?.status==='counting'||meta?.status==='finished';
  const leading=active?leadingPositions(candidates,meta?.seats):[],elected=active?confirmedElected(candidates):[];
  const rows=electedOnly?elected:leading,seats=meta?.seats;
  const titleId=`positions-${office}`;
  const waiting=!meta||meta.status==='waiting';
  return <section className={`national-panel position-panel panel ${office==='senator'?'senate-position-panel':''}`} aria-labelledby={titleId}>
    <div className="national-heading"><div><span className="section-tag"><ListOrdered size={14} aria-hidden="true" /> SANTA CATARINA · {titles[office].toUpperCase()}</span><h2 id={titleId}>{titles[office]} por posição</h2><p className="small muted">{seats?`${seats} vagas · `:''}{office==='senator'?'Os mais votados até o momento.':'Primeiras posições no ranking de votos nominais.'}</p></div><div className="national-progress"><strong>{percentage(meta?.percentage)}</strong><span className="small muted">das seções totalizadas</span></div></div>
    <div className="position-controls"><div className="position-switch" role="group" aria-label={`Visualização de ${titles[office]}`}><button aria-pressed={!electedOnly} onClick={()=>setElectedOnly(false)}><ListOrdered size={14} />Por posição</button><button aria-pressed={electedOnly} onClick={()=>setElectedOnly(true)}><ShieldCheck size={14} />Eleitos confirmados{active&&<span>{elected.length}</span>}</button></div><span className="small muted">{electedOnly?'Confirmações publicadas pelo TSE':'Ordem atual por votos · empates mantidos'}</span></div>
    {rows.length?<ol className={`position-list ${electedOnly?'position-elected-list':''}`} aria-label={`${electedOnly?'Eleitos confirmados':'Primeiras posições'} para ${titles[office]}`}>{rows.map(c=><li className="position-candidate" key={c.id}>
      <span className="position-rank" aria-label={`${c.rank}ª posição`}>{c.rank}º</span><Avatar name={c.name} url={c.photoUrl} /><div className="position-identity"><h3>{c.name}</h3><p className="small muted">{c.party} · {c.number}</p>{c.officialElected?<span className="position-elected"><ShieldCheck size={11} />{c.officialStatus || 'Eleito'} · TSE</span>:c.officialStatus&&<span className="position-status">{c.officialStatus}</span>}</div><div className="position-votes"><strong>{number(c.votes)}</strong><span>votos · {percentage(c.percentage)}</span></div>
    </li>)}</ol>:<div className="national-waiting"><Vote size={25} aria-hidden="true" /><div><h3>{waiting?'Aguardando início da totalização':meta?.status==='unavailable'?'Aguardando dados oficiais':electedOnly?'Nenhum eleito confirmado pelo TSE':'Aguardando posições por votos'}</h3><p className="small muted">{waiting?'Os nomes e as posições aparecerão com os primeiros votos divulgados pelo TSE.':electedOnly?'Este quadro será atualizado assim que o TSE confirmar eleitos para o cargo.':'As posições serão exibidas quando a votação oficial estiver disponível.'}</p></div></div>}
    {office!=='senator'&&<p className="position-note"><ShieldCheck size={14} aria-hidden="true" /> Deputados seguem o sistema proporcional. Estar nas primeiras posições por votos não garante uma vaga; o selo de eleito aparece somente com confirmação do TSE.</p>}
    <div className="national-footer"><span>{electedOnly?active?`${elected.length} ${elected.length===1?'eleito confirmado':'eleitos confirmados'}`:'Aguardando confirmação oficial do TSE':active&&rows.length?`${rows.length} nomes nas primeiras ${seats} posições · empates incluídos`:'Votação até o momento · a ordem pode mudar'}</span><span>{meta?.updatedAt?`Dados TSE: ${clock(meta.updatedAt)}`:'Consultando a fonte oficial'}</span></div>
  </section>;
}
