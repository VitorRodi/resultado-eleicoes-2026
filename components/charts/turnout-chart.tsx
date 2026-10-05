'use client';
import {useState} from 'react';
import {Users,Vote} from 'lucide-react';
import {officeLabel} from '@/lib/config';
import {number,percentage,clock} from '@/lib/formatting';
import type {OfficeFilter} from '@/components/layout/panel-filters';
import {OFFICES,type ElectionSnapshot,type Office} from '@/types/election';

type Row={label:string;value:number|null|undefined;color:string};
function Bars({rows,total}:{rows:Row[];total:number|null|undefined}){
  return <ul className="turnout-bars">{rows.map(row=><li key={row.label}><div><span>{row.label}</span><strong>{number(row.value)}</strong></div><div className="turnout-bar-track" aria-hidden="true"><span style={{width:`${row.value!=null&&total!=null&&total>0?Math.min(100,row.value/total*100):0}%`,background:row.color}}/></div></li>)}</ul>;
}
export default function TurnoutChart({snapshot,uf,stateName,officeFilter='all',pendingOnly=false}:{snapshot:ElectionSnapshot|null;uf:string;stateName:string;officeFilter?:OfficeFilter;pendingOnly?:boolean}){
  const [chosen,setChosen]=useState<Office>('president');
  const available=OFFICES.filter(o=>!pendingOnly||snapshot?.offices[o].status!=='finished');
  const office=officeFilter==='all'?(available.includes(chosen)?chosen:available[0]||chosen):officeFilter,statistics=snapshot?.statistics?.[office],meta=snapshot?.offices[office];
  if(!available.length)return null;
  const participants:Row[]=[{label:'Eleitores aptos no estado',value:statistics?.eligible,color:'#356f9a'},{label:'Votaram · comparecimento apurado',value:statistics?.turnout,color:'#17655c'},{label:'Não compareceram · abstenções apuradas',value:statistics?.abstentions,color:'#936320'}];
  const votes:Row[]=[{label:'Votos válidos',value:statistics?.validVotes,color:'#17655c'},{label:'Votos em branco',value:statistics?.blankVotes,color:'#697c83'},{label:'Votos nulos · incluindo técnicos',value:statistics?.nullVotes,color:'#b13c46'}];
  if(statistics?.annulledVotes!=null&&statistics.annulledVotes>0)votes.push({label:'Votos anulados',value:statistics.annulledVotes,color:'#75508f'});
  if(statistics?.annulledSubJudiceVotes!=null&&statistics.annulledSubJudiceVotes>0)votes.push({label:'Votos anulados sub judice',value:statistics.annulledSubJudiceVotes,color:'#806348'});
  if(statistics?.noCandidateVotes!=null&&statistics.noCandidateVotes>0)votes.push({label:'Votos sem candidato para votar',value:statistics.noCandidateVotes,color:'#53656b'});
  return <section className="analysis-panel panel turnout-panel" id="comparecimento" aria-labelledby="turnout-title">
    <header className="analysis-heading"><div><span className="section-tag"><Users size={15}/> ELEITORES E VOTOS · {uf.toUpperCase()}</span><h2 id="turnout-title">Eleitorado, comparecimento e votos nulos</h2><p className="small muted">{stateName} · referência: {officeLabel(office,uf)} · {percentage(meta?.percentage)} das seções totalizadas.</p></div>{officeFilter==='all'&&<label className="turnout-office">Cargo de referência<select aria-label="Cargo do gráfico de votantes e nulos" value={office} onChange={e=>setChosen(e.target.value as Office)}>{available.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></label>}</header>
    <dl className="turnout-totals"><div><dt>Eleitores aptos</dt><dd>{number(statistics?.eligible)}<small>Eleitorado total do estado</small></dd></div><div><dt>Já votaram · apurado</dt><dd>{number(statistics?.turnout)}<small>Comparecimento nas seções processadas</small></dd></div><div><dt>Votos nulos no cargo</dt><dd>{number(statistics?.nullVotes)}<small>{statistics?.nullVotesPercentage!=null?`${percentage(statistics.nullVotesPercentage)} dos votos computados`:'Aguardando totalização'}</small></dd></div></dl>
    <div className="turnout-charts"><article><h3><Users size={17}/>Quantos podem votar e quantos votaram?</h3><p className="small muted">Pessoas · barras em relação ao eleitorado apto.</p><Bars rows={participants} total={statistics?.eligible}/><p className="small muted turnout-detail">{statistics?.countedElectorate!=null?`${number(statistics.countedElectorate)} eleitores pertencem às seções já apuradas.`:'Eleitorado das seções apuradas ainda não divulgado.'}{statistics?.turnoutPercentage!=null?` Comparecimento divulgado pelo TSE: ${percentage(statistics.turnoutPercentage)}.`:''}</p></article>
    <article><h3><Vote size={17}/>Como foram os votos?</h3><p className="small muted">{officeLabel(office,uf)} · {number(statistics?.totalVotes)} votos computados.</p><Bars rows={votes} total={statistics?.totalVotes}/><p className="small muted turnout-detail">Nulos incluem os nulos técnicos{statistics?.technicalNullVotes!=null?` (${number(statistics.technicalNullVotes)} técnicos)`:''}. Votos anulados e sub judice são categorias separadas.{office==='senator'?' No Senado, cada eleitor pode votar em dois candidatos: votos e pessoas têm totais diferentes.':''}</p></article></div>
    {(!meta||meta.status==='waiting'||meta.status==='unavailable')&&<p className="small muted analysis-note" role="status">{meta?.status==='unavailable'?'Dados desse cargo estão indisponíveis no momento.':'Aguardando início da totalização. Os números de participação e votos aparecerão com os primeiros resultados.'}</p>}
    <p className="small muted analysis-note">Durante a apuração, comparecimento e abstenções são os registrados nas seções já processadas. Eleitores de seções pendentes não são classificados como abstenção. Os gráficos mostram pessoas e votos separadamente; as barras de eleitorado não devem ser somadas. {meta?.updatedAt?`Dados TSE: ${clock(meta.updatedAt)} · Brasília.`:''}{snapshot?.stale?' Consulta com aviso; últimos dados válidos preservados quando disponíveis.':''}</p>
  </section>;
}
