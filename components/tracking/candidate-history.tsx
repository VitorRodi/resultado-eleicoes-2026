'use client';
import {useState} from 'react';
import {LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid} from 'recharts';
import {History,Download} from 'lucide-react';
import {clock,number,percentage} from '@/lib/formatting';
import {officeLabel} from '@/lib/config';
import {selectionKey} from '@/lib/preferences';
import {candidateSelection,csvCell,type CandidateHistory as HistoryData} from '@/lib/panel-tools';
import {downloadBlob} from '@/lib/download';
import type {Candidate} from '@/types/election';
export default function CandidateHistory({history,candidates,uf,warning}:{history:HistoryData;candidates:Candidate[];uf:string;warning:string|null}){
  const [chosen,setChosen]=useState(''),[metric,setMetric]=useState<'votes'|'rank'|'percentage'>('votes');
  const candidate=candidates.find(c=>selectionKey(candidateSelection(c))===chosen)||candidates[0];
  const points=candidate?history[selectionKey(candidateSelection(candidate))]||[]:[];
  const plotted=points.map(p=>({...p,time:Date.parse(p.at)}));
  function exportHistory(){
    if(!candidate||!points.length)return;
    const rows=[['UF','Cargo','Candidato','Dados TSE (ISO UTC)','Dados TSE (Brasília)','Votos','Percentual','Posição'],...points.map(p=>[uf.toUpperCase(),officeLabel(candidate.office,uf),candidate.name,p.at,new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}).format(new Date(p.at)),p.votes,p.percentage,p.rank])];
    downloadBlob(new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),`historico-${uf}-${candidate.number}.csv`);
  }
  return <section className="analysis-panel panel" id="historico" aria-labelledby="history-title"><header className="analysis-heading"><div><span className="section-tag"><History size={15}/> EVOLUÇÃO DO SEU ACOMPANHAMENTO</span><h2 id="history-title">Histórico da apuração</h2><p className="small muted">Registros oficiais recebidos neste navegador, a partir do seu acompanhamento. Até 240 registros por candidato.</p></div><button className="secondary-button" disabled={!points.length} onClick={exportHistory}><Download size={15}/>Baixar histórico CSV</button></header>
    {warning&&<p className="warning-text small" role="status">{warning}</p>}
    <div className="analysis-filters"><label>Candidato<select value={candidate?selectionKey(candidateSelection(candidate)):''} aria-label="Candidato do histórico" onChange={e=>setChosen(e.target.value)}>{!candidates.length&&<option value="">Adicione um candidato</option>}{candidates.map(c=><option key={selectionKey(candidateSelection(c))} value={selectionKey(candidateSelection(c))}>{c.name} · {officeLabel(c.office,uf)}</option>)}</select></label><label>Indicador<select value={metric} aria-label="Indicador do histórico" onChange={e=>setMetric(e.target.value as typeof metric)}><option value="votes">Votos</option><option value="rank">Posição</option><option value="percentage">Porcentagem</option></select></label></div>
    {points.length<2?<p className="analysis-empty muted">{points.length===1?`Primeiro registro: ${clock(points[0].at)}. O gráfico aparecerá quando o TSE publicar uma nova atualização.`:'Adicione um candidato e aguarde um resultado oficial com votos para iniciar o histórico.'}</p>:<div className="history-chart" role="img" aria-label={`Evolução de ${candidate?.name}: ${metric==='rank'?'posição':metric==='votes'?'votos':'porcentagem'}. Os valores também estão na tabela abaixo.`}><ResponsiveContainer width="100%" height={260} minWidth={0}><LineChart data={plotted} margin={{left:8,right:15,top:15,bottom:10}}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={value=>clock(new Date(value).toISOString())} tick={{fill:'var(--muted)',fontSize:12}} minTickGap={45}/><YAxis reversed={metric==='rank'} allowDecimals={metric==='percentage'} domain={metric==='rank'?['dataMin','dataMax']:metric==='percentage'?[0,100]:[0,'auto']} tick={{fill:'var(--muted)',fontSize:12}} width={70} tickFormatter={v=>metric==='percentage'?`${v}%`:number(v)}/><Tooltip content={({active,payload})=>active&&payload?.length?<div className="chart-tooltip"><strong>{clock(payload[0].payload.at)} · Brasília</strong><p>{metric==='rank'?`${payload[0].payload.rank}º`:metric==='percentage'?percentage(payload[0].payload.percentage):`${number(payload[0].payload.votes)} votos`}</p></div>:null}/><Line type="stepAfter" dataKey={metric} stroke="var(--accent)" strokeWidth={3} dot={points.length<20} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>}
    {points.length>0&&<details className="history-values"><summary>Ver registros em tabela ({points.length})</summary><div className="table-scroll" tabIndex={0}><table><thead><tr><th scope="col">Dados TSE · Brasília</th><th scope="col">Votos</th><th scope="col">%</th><th scope="col">Posição</th></tr></thead><tbody>{[...points].reverse().map(p=><tr key={p.at}><td>{new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'}).format(new Date(p.at))} · {clock(p.at)}</td><td>{number(p.votes)}</td><td>{percentage(p.percentage)}</td><td>{p.rank}º</td></tr>)}</tbody></table></div></details>}
    <p className="small muted analysis-note">O histórico é estadual e fica salvo neste navegador. Fechar o painel interrompe a coleta: atualizações publicadas enquanto ele estava fechado não são recuperadas.</p>
  </section>;
}
