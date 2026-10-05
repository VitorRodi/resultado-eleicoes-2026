'use client';
import { useEffect, useId, useState } from 'react';
import { Globe2, ExternalLink } from 'lucide-react';
import { BRAZIL_STATES } from '@/lib/brazil-states';
import { BRAZIL_GEOMETRY } from '@/lib/brazil-geometry';
import { clock, number, percentage } from '@/lib/formatting';
import type { BrazilProgress, StateProgress } from '@/services/tse/progress';
import { usePresidentsByState } from '@/hooks/use-presidents-by-state';
import { presidentialMapTone, PRESIDENTIAL_MAP_COLORS } from '@/lib/presidential-map';
import FocusPanel from '@/components/layout/focus-panel';
import {useDisplaySettings} from '@/components/layout/display-settings';
import {orderStates,progressStates,type StateSort} from '@/lib/live-features';
import StateResultFilters from '@/components/layout/state-result-filters';
import {useProgressHistory} from '@/hooks/use-progress-history';
import ProgressHistory from './progress-history';
const SYMBOLS={lula:'▲',flavio:'●',tie:'=',other:'◆',unavailable:'—'};
const pendingSections=(progress:StateProgress|undefined)=>progress?.sections!=null&&progress.totalSections!=null?progress.totalSections-progress.sections:null;
const sectionSummary=(progress:StateProgress|undefined)=>progress?.sections!=null&&progress.totalSections!=null?`${number(progress.sections)} seções apuradas; ${number(pendingSections(progress))} faltam`:'Contagem de seções indisponível';
function shade(value:number|null){if(value===null)return '#d8e3df';const p=Math.max(0,Math.min(100,value))/100;return `rgb(${Math.round(216-193*p)},${Math.round(227-126*p)},${Math.round(223-131*p)})`;}
export default function BrazilProgressMap({onSelectState}:{onSelectState:(uf:string)=>void}){
  const patternId=useId(),{mapPatterns}=useDisplaySettings();
  const [data,setData]=useState<BrazilProgress|null>(null),[selected,setSelected]=useState('SC');
  const [mode,setMode]=useState<'leaders'|'progress'>('leaders');
  const [sort,setSort]=useState<StateSort>('alphabetical'),[pending,setPending]=useState(false);
  const {history,warning:historyWarning}=useProgressHistory(data);
  const visibleStates=orderStates(progressStates(BRAZIL_STATES,data),sort,pending);
  const {data:presidents,error:presidentsError}=usePresidentsByState();
  useEffect(()=>{
    let cancelled=false,active:AbortController|null=null;
    async function refresh(){if(active||document.hidden)return;active=new AbortController();try{
      const response=await fetch('/api/elections/br/progress',{cache:'no-store',signal:active.signal});
      if(!response.ok)throw new Error('Acompanhamento indisponível.');
      const result:BrazilProgress=await response.json();
      if(!Array.isArray(result.states)||result.states.length!==27)throw new Error('Acompanhamento inválido.');
      if(!cancelled)setData(previous=>previous?.updatedAt&&(!result.updatedAt||result.updatedAt<previous.updatedAt)?{...previous,stale:true}:result);
    }catch{if(!cancelled)setData(previous=>previous?{...previous,stale:true}:null);}finally{active=null;}}
    void refresh();const timer=window.setInterval(()=>void refresh(),30_000);
    const onVisible=()=>{if(!document.hidden)void refresh();};document.addEventListener('visibilitychange',onVisible);
    return()=>{cancelled=true;window.clearInterval(timer);active?.abort();document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  const state=data?.states.find(s=>s.uf===selected),definition=BRAZIL_STATES.find(s=>s.uf===selected)!;
  const presidentialResult=presidents?.states.find(s=>s.uf===selected),selectedTone=presidentialMapTone(presidentialResult);
  const toneFor=(uf:string)=>presidentialMapTone(presidents?.states.find(s=>s.uf===uf));
  return <FocusPanel label="Mapa do Brasil"><section className="brazil-map-panel panel" aria-labelledby="brazil-map-title" id="mapa-brasil">
    <div className="national-heading"><div><span className="section-tag"><Globe2 size={14} aria-hidden="true"/> BRASIL · PRESIDENTE POR ESTADO</span><h2 id="brazil-map-title">{mode==='leaders'?'Quem está na frente em cada estado?':'Quanto já foi apurado em cada estado?'}</h2><p className="small muted">{mode==='leaders'?'Cores pela liderança atual em votos · apuração parcial não significa eleição.':'Percentual de seções totalizadas para presidente · 26 estados e Distrito Federal.'}</p></div><span className="map-live small muted">Atualização a cada 30s</span></div>
    <div className="map-mode-controls position-switch" role="group" aria-label="Visualização do mapa"><button aria-pressed={mode==='leaders'} onClick={()=>setMode('leaders')}>Liderança por votos</button><button aria-pressed={mode==='progress'} onClick={()=>setMode('progress')}>Progresso da apuração</button></div>
    {mode==='leaders'&&(presidentsError||presidents?.stale)&&<p className="warning small" role="status">Parte das lideranças não atualizou. As últimas informações válidas são preservadas quando disponíveis.</p>}
    <StateResultFilters sort={sort} pending={pending} onSort={setSort} onPending={setPending} label="Ordenar estados do mapa"/><div className="brazil-map-layout"><div className="map-visual"><svg viewBox="0 0 550 530" aria-label={mode==='leaders'?'Mapa da liderança presidencial por UF':'Mapa do progresso da apuração presidencial por UF'} role="group">
      <defs>{Object.entries(PRESIDENTIAL_MAP_COLORS).map(([kind,color])=><pattern id={`${patternId}-${kind}`} key={kind} patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill={color}/>{kind==='lula'?<path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="#fff" strokeOpacity=".55"/>:kind==='flavio'?<circle cx="4" cy="4" r="1.4" fill="#fff" fillOpacity=".75"/>:kind==='tie'?<path d="M0 4H8M4 0V8" stroke="#fff" strokeOpacity=".5"/>:kind==='other'?<path d="M0 4H8" stroke="#fff" strokeOpacity=".6"/>:<path d="M0 0L8 8" stroke="#b8c6d8" strokeOpacity=".3"/>}</pattern>)}</defs>
      {BRAZIL_GEOMETRY.map(shape=>{const s=BRAZIL_STATES.find(s=>s.id===shape.id)!,progress=data?.states.find(p=>p.uf===s.uf),tone=toneFor(s.uf),label=`Ver detalhes de ${s.name}: ${mode==='leaders'?`${tone.label}; `:''}${percentage(progress?.percentage)} das seções totalizadas; ${sectionSummary(progress)}`;return <path key={shape.id} d={shape.d} fill={mode==='leaders'?mapPatterns?`url(#${patternId}-${tone.kind})`:tone.color:shade(progress?.percentage??null)} className={selected===s.uf?'map-state is-selected':'map-state'} role="button" tabIndex={0} aria-label={label} onClick={()=>setSelected(s.uf)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(s.uf);}}}><title>{label}</title></path>;})}
      {BRAZIL_STATES.filter(s=>s.uf!=='DF').map(s=><text key={s.uf} x={(s.label[0]+74)*13} y={(6-s.label[1])*13} textAnchor="middle" className="map-uf-label" aria-hidden="true">{s.uf}{mapPatterns&&mode==='leaders'&&<tspan dx="2">{SYMBOLS[toneFor(s.uf).kind]}</tspan>}</text>)}
      <circle cx={(BRAZIL_STATES.find(s=>s.uf==='DF')!.label[0]+74)*13} cy={(6-BRAZIL_STATES.find(s=>s.uf==='DF')!.label[1])*13} r="5" stroke="#d2e6ff" strokeWidth="1" fill={mode==='leaders'?toneFor('DF').color:'#d2e6ff'} pointerEvents="none"/>
    </svg>{mode==='leaders'?<div className="map-leader-legend" aria-label="Legenda das cores do mapa">{([['lula','Lula'],['flavio','Flávio Bolsonaro'],['tie','Empate'],['other','Outro candidato'],['unavailable','Sem dados']] as const).map(([kind,label])=><span key={kind}><i style={{background:PRESIDENTIAL_MAP_COLORS[kind]}} aria-hidden="true"/>{mapPatterns&&<b aria-hidden="true">{SYMBOLS[kind]}</b>}{label}</span>)}</div>:<div className="map-legend"><span>0%</span><div aria-hidden="true"/><span>100%</span><small>Cor mais clara = mais seções totalizadas</small></div>}<p className="small muted map-instruction">Clique no mapa ou na lista para ver os dados do estado no painel ao lado.</p><ProgressHistory points={history[selected]||[]} uf={selected} name={definition.name} warning={historyWarning}/></div>
    <div className="map-data"><div className="selected-state"><span className="section-tag">{selected} · {definition.name.toUpperCase()}</span>{mode==='leaders'&&<div className="selected-state-leader"><i style={{background:selectedTone.color}} aria-hidden="true"/><div><b>{selectedTone.leader?.name||selectedTone.label}</b>{selectedTone.leader&&<p className="small muted">{selectedTone.leader.party} · {percentage(selectedTone.leader.percentage)} · {number(selectedTone.leader.votes)} votos na UF</p>}<p className="small muted">{presidentialResult?.stale?'Última liderança válida · ':''}{presidentialResult?.meta.updatedAt?`Votos TSE: ${clock(presidentialResult.meta.updatedAt)}`:'Aguardando resultado estadual'}</p></div></div>}<strong>{percentage(state?.percentage)}</strong><p className="small muted">das seções totalizadas para presidente</p><dl className="selected-section-counts"><div><dt>Seções apuradas</dt><dd>{number(state?.sections)}</dd></div><div><dt>Faltam apurar</dt><dd>{number(pendingSections(state))}</dd></div><div><dt>Total de seções</dt><dd>{number(state?.totalSections)}</dd></div></dl></div><div className="state-progress-grid" aria-label="Seções apuradas e pendentes por estado">{visibleStates.map(s=>{const progress=s,tone=toneFor(s.uf);return <button key={s.uf} className={selected===s.uf?'state-progress-button is-selected':'state-progress-button'} aria-pressed={selected===s.uf} aria-label={`${s.name}: ${mode==='leaders'?`${tone.label}; `:''}${percentage(progress?.percentage)} totalizado; ${sectionSummary(progress)}`} onClick={()=>setSelected(s.uf)}><span>{mode==='leaders'&&<em className="state-leader-dot" style={{background:tone.color}} aria-hidden="true"/>}{s.uf}<small>{s.name}</small></span><strong>{percentage(progress?.percentage)}</strong><span className="state-section-counts" aria-hidden="true"><span><small>Apuradas</small><b>{number(progress?.sections)}</b></span><span><small>Faltam</small><b>{number(pendingSections(progress))}</b></span></span><i aria-hidden="true"><span style={{width:`${progress?.percentage??0}%`}}/></i></button>;})}</div>{!visibleStates.length&&<p className="small muted">Todos os estados têm totalização final. Desmarque o filtro para ver os resultados.</p>}</div></div>
    <p className="map-sections-note small muted">Apuradas: seções eleitorais já totalizadas pelo TSE para presidente. Faltam: total de seções menos as já totalizadas.</p>
    <div className="national-footer"><span>{data?.stale?'Atualização indisponível · último progresso válido preservado':data?.updatedAt?`Progresso TSE: ${clock(data.updatedAt)}`:'Consultando acompanhamento oficial do TSE'}</span><span>{mode==='leaders'&&presidentialResult?.source&&<><a href={presidentialResult.source} target="_blank" rel="noopener noreferrer">Votos TSE <ExternalLink size={11}/></a> · </>}<a href={data?.source||'https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados'} target="_blank" rel="noopener noreferrer">Progresso TSE <ExternalLink size={11}/></a> · <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noopener noreferrer">Malha IBGE <ExternalLink size={11}/></a></span></div>
    <div className="map-open-state"><button className="add-button" onClick={()=>onSelectState(selected.toLowerCase())}>Abrir painel completo de {definition.name} →</button></div>
  </section></FocusPanel>;
}
