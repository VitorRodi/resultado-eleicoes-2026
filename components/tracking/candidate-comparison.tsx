'use client';
import {useState} from 'react';
import {ArrowLeftRight} from 'lucide-react';
import {officeLabel} from '@/lib/config';
import {number,percentage,clock} from '@/lib/formatting';
import {municipalKey,selectionKey} from '@/lib/preferences';
import {candidateSelection,municipalPosition,watchedCandidates} from '@/lib/panel-tools';
import {OFFICES,type ElectionSnapshot,type Office,type WatchPreferences} from '@/types/election';
import type {OfficeFilter} from '@/components/layout/panel-filters';

export default function CandidateComparison({snapshot,preferences,uf,officeFilter='all',pendingOnly=false}:{snapshot:ElectionSnapshot|null;preferences:WatchPreferences;uf:string;officeFilter?:OfficeFilter;pendingOnly?:boolean}){
  const available=OFFICES.filter(o=>!pendingOnly||snapshot?.offices[o].status!=='finished');const watched=watchedCandidates(snapshot,preferences).filter(c=>available.includes(c.office));
  const [chosenOffice,setChosenOffice]=useState<Office|null>(null);
  const [selected,setSelected]=useState<Record<string,string[]>>({}),[city,setCity]=useState('state');
  const office=officeFilter==='all'?(chosenOffice&&available.includes(chosenOffice)?chosenOffice:available.find(o=>watched.filter(c=>c.office===o).length>=2)||watched[0]?.office||available[0]||'federalDeputy'):officeFilter;
  const candidates=watched.filter(c=>c.office===office),ids=(selected[office]??candidates.slice(0,2).map(c=>c.id)).filter(id=>candidates.some(c=>c.id===id));
  const chosen=candidates.filter(c=>ids.includes(c.id));
  const codes=[...new Set(preferences.regional.filter(s=>s.office===office).flatMap(s=>s.municipalityCodes))];
  const scope=codes.includes(city)?city:'state',municipal=scope==='state'?null:snapshot?.municipalResults[municipalKey({office,code:scope})];
  const meta=scope==='state'?snapshot?.offices[office]:municipal?.meta;
  const active=meta&&['counting','finished'].includes(meta.status);
  const rows=chosen.map(c=>{
    const vote=municipal?.candidateVotes[c.id];
    return {c,votes:active?(scope==='state'?c.votes:vote?.votes??null):null,pct:active?(scope==='state'?c.percentage:vote?.percentage??null):null,rank:active?(scope==='state'?c.rank:municipalPosition(municipal?.candidateVotes||{},c.id)):null};
  });
  const allAvailable=rows.length>=2&&rows.every(r=>r.votes!==null),top=allAvailable?Math.max(...rows.map(r=>r.votes!)):null;
  function toggle(id:string){setSelected(current=>({...current,[office]:ids.includes(id)?ids.filter(i=>i!==id):[...ids,id].slice(0,4)}));}
  return <section className="analysis-panel panel" id="comparacao" aria-labelledby="comparison-title"><header className="analysis-heading"><div><span className="section-tag"><ArrowLeftRight size={15}/> MESMO CARGO · MESMA ABRANGÊNCIA</span><h2 id="comparison-title">Compare seus candidatos</h2><p className="small muted">Escolha de dois a quatro candidatos acompanhados para comparar lado a lado.</p></div></header>
    <div className="analysis-filters">{officeFilter==='all'&&<label>Cargo<select value={office} onChange={e=>{setChosenOffice(e.target.value as Office);setCity('state');}} aria-label="Cargo da comparação">{available.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></label>}<label>Abrangência<select aria-label="Abrangência da comparação" value={scope} onChange={e=>setCity(e.target.value)}><option value="state">Estado · {uf.toUpperCase()}</option>{codes.map(code=><option key={code} value={code}>{snapshot?.municipalities.find(m=>m.code===code)?.name||code}</option>)}</select></label></div>
    <div className="comparison-options" role="group" aria-label="Candidatos da comparação">{candidates.map(c=><label key={selectionKey(candidateSelection(c))}><input type="checkbox" checked={ids.includes(c.id)} disabled={!ids.includes(c.id)&&ids.length>=4} onChange={()=>toggle(c.id)}/>{c.name}<span className="muted">{c.party} · {c.number}</span></label>)}</div>
    {candidates.length<2?<p className="analysis-empty muted">Adicione pelo menos dois candidatos do mesmo cargo em “Candidatos que você acompanha” ou “Votação por município”.</p>:chosen.length<2?<p className="analysis-empty muted">Selecione pelo menos dois candidatos acima.</p>:<div className="table-scroll" tabIndex={0} role="region" aria-label="Tabela de comparação, deslize para ver todos os candidatos"><table className="comparison-table"><caption className="sr-only">Comparação de {officeLabel(office,uf)} em {scope==='state'?uf.toUpperCase():municipal?.municipality.name||scope}</caption><thead><tr><th scope="col">Indicador</th>{rows.map(r=><th scope="col" key={r.c.id}>{r.c.name}<small>{r.c.party} · {r.c.number}</small></th>)}</tr></thead><tbody>
      <tr><th scope="row">Votos</th>{rows.map(r=><td key={r.c.id} className="comparison-votes">{number(r.votes)}</td>)}</tr>
      <tr><th scope="row">Percentual do candidato</th>{rows.map(r=><td key={r.c.id}>{percentage(r.pct)}</td>)}</tr>
      <tr><th scope="row">Posição {scope==='state'?'no estado':'no município'}</th>{rows.map(r=><td key={r.c.id}>{r.rank===null?'—':`${r.rank}º`}</td>)}</tr>
      <tr><th scope="row">Diferença para o mais votado desta comparação</th>{rows.map(r=><td key={r.c.id}>{top===null?'—':r.votes===top?'Mesma votação máxima':`${number(top-r.votes!)} votos`}</td>)}</tr>
      <tr><th scope="row">Situação oficial no estado</th>{rows.map(r=><td key={r.c.id}>{r.c.officialElected?<span className="positive">Eleito confirmado pelo TSE</span>:r.c.officialStatus||'Ainda não informada'}</td>)}</tr>
    </tbody></table></div>}
    <p className="small muted analysis-note">{scope==='state'?'':'A posição municipal considera todas as candidaturas do cargo naquela cidade. '}{meta?.updatedAt?`Dados TSE: ${clock(meta.updatedAt)} · ${percentage(meta.percentage)} das seções totalizadas.`:'Aguardando dados oficiais.'}{(municipal?.stale||snapshot?.stale)&&' Últimos resultados válidos, consulta com aviso.'} Deputados: posição por votos não garante eleição.</p>
    {!codes.length&&<p className="small muted">Para comparar nas cidades, adicione municípios em “Votação por município”.</p>}
  </section>;
}
