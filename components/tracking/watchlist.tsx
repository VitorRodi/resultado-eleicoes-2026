'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Search, ShieldCheck, X, Download, List, LayoutGrid } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import TrackedCard from './tracked-card';
import RegionalChart from '@/components/charts/regional-chart';
import { officeLabel, canonical } from '@/lib/config';
import { applyRegionalSelections, regionalRows, selectionKey } from '@/lib/preferences';
import { OFFICES, type Candidate, type CandidateSelection, type ElectionSnapshot, type RegionalSelection, type TrackedCandidate, type WatchPreferences } from '@/types/election';
import type { OfficeFilter } from '@/components/layout/panel-filters';
import {matchesCandidate,selectedResultsCsv,watchedCandidates,type CandidateHistory as HistoryData} from '@/lib/panel-tools';
import {downloadBlob} from '@/lib/download';
import FocusPanel from '@/components/layout/focus-panel';
import CandidateComparison from './candidate-comparison';
import CandidateHistory from './candidate-history';
import ShareCandidate from './share-candidate';
import {number,percentage} from '@/lib/formatting';

function Picker({ uf='sc',snapshot, preferences, regional, initial, initialOffice='all', onClose, onSave }: { snapshot:ElectionSnapshot|null; preferences:WatchPreferences; regional:boolean; initial?:RegionalSelection; initialOffice?:string; onClose:()=>void; onSave:(s:RegionalSelection[])=>void;uf?:string }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [office,setOffice]=useState(initial?.office||initialOffice),[query,setQuery]=useState(''),[cityQuery,setCityQuery]=useState('');
  const [selected,setSelected]=useState<CandidateSelection[]>(initial?[initial]:[]),[cities,setCities]=useState<string[]>(initial?.municipalityCodes || []);
  const multiple=regional&&!initial;
  const all=snapshot?OFFICES.flatMap(o=>snapshot[o]):[];
  const favoriteKeys=new Set([...preferences.candidates,...preferences.regional].map(selectionKey));
  const candidates=all.filter(c=>(office==='all'||c.office===office)&&matchesCandidate(c,query)).sort((a,b)=>Number(favoriteKeys.has(selectionKey({office:b.office,candidateId:b.id})))-Number(favoriteKeys.has(selectionKey({office:a.office,candidateId:a.id})))||a.name.localeCompare(b.name,'pt-BR'));
  const selectedCandidates=all.filter(c=>selected.some(s=>selectionKey({office:c.office,candidateId:c.id})===selectionKey(s)));
  const existing=regional?preferences.regional:preferences.candidates;
  const municipalities=snapshot?.municipalities || [];
  const favoriteCities=new Set(preferences.regional.flatMap(s=>s.municipalityCodes));
  const filteredCities=municipalities.filter(m=>canonical(m.name).includes(canonical(cityQuery))).sort((a,b)=>Number(favoriteCities.has(b.code))-Number(favoriteCities.has(a.code))||a.name.localeCompare(b.name,'pt-BR'));
  const proposed=selected.map(s=>({...s,municipalityCodes:cities}));
  let limitError='';
  if(regional)try{applyRegionalSelections(preferences.regional,proposed,multiple);}catch(error){limitError=error instanceof Error?error.message:'Limite de acompanhamentos atingido.';}
  function toggleCandidate(s:CandidateSelection){setSelected(current=>multiple?current.some(c=>selectionKey(c)===selectionKey(s))?current.filter(c=>selectionKey(c)!==selectionKey(s)):[...current,s]:[s]);}
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  function toggleCity(code:string){setCities(current=>current.includes(code)?current.filter(c=>c!==code):[...current,code]);}
  return <dialog ref={dialog} className="picker-dialog" aria-labelledby="picker-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="picker-shell"><header className="picker-header"><div><span className="section-tag">MONTE SEU ACOMPANHAMENTO</span><h2 id="picker-title">{initial?'Editar candidato e cidades':regional?'Adicionar candidatos e cidades':'Adicionar candidato'}</h2><p className="small muted">{multiple?'Selecione vários candidatos. As cidades escolhidas serão acrescentadas a todos.':regional?`Escolha uma candidatura e os municípios de ${uf.toUpperCase()}.`:'Escolha entre as candidaturas oficiais dos cinco cargos.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar seleção"><X size={20} /></button></header>
    <div className="picker-body"><div className="picker-step"><span className="step-number">01</span><h3>Qual candidato?</h3></div>
    <div className="picker-filters"><label className="search"><Search size={16} /><input autoFocus aria-label="Buscar candidato para acompanhar" placeholder="Nome, número ou partido" value={query} onChange={e=>setQuery(e.target.value)} /></label><select aria-label="Filtrar candidatos por cargo" value={office} onChange={e=>setOffice(e.target.value)}><option value="all">Todos os cargos</option>{OFFICES.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></div>
    {selectedCandidates.length>0&&<div className="candidate-selection-summary"><p className="small muted">{selectedCandidates.length} {selectedCandidates.length===1?'candidato selecionado':'candidatos selecionados'}</p><div className="city-chips">{selectedCandidates.map(c=><button key={selectionKey({office:c.office,candidateId:c.id})} onClick={()=>setSelected(current=>current.filter(s=>selectionKey(s)!==selectionKey({office:c.office,candidateId:c.id})))} aria-label={`Desmarcar ${c.name}`}>{c.name}<X size={12}/></button>)}</div></div>}
    <div className="candidate-options" role={multiple?'group':'radiogroup'} aria-label={multiple?'Selecione candidatos':'Escolha um candidato'}>{candidates.slice(0,40).map(c=>{
      const s={office:c.office,candidateId:c.id},key=selectionKey(s),checked=selected.some(s=>selectionKey(s)===key);
      const already=existing.some(p=>selectionKey(p)===key),disabled=!multiple&&already&&(!initial||selectionKey(initial)!==key);
      return <label className={`candidate-option ${checked?'is-selected':''}`} key={key}><input type={multiple?'checkbox':'radio'} name={multiple?key:'candidate'} checked={checked} disabled={disabled} onChange={()=>toggleCandidate(s)} /><Avatar name={c.name} url={c.photoUrl} /><span><strong>{c.name}</strong><small>{officeLabel(c.office,uf)} · {c.party} · {c.number}{already?' · já acompanhado':''}</small></span></label>;
    })}{!candidates.length && <p className="picker-empty muted">{all.length?'Nenhum candidato encontrado.':'Aguardando as candidaturas oficiais. Tente novamente após a atualização.'}</p>}</div>
    {candidates.length>40 && <p className="small muted results-hint">Exibindo 40 de {candidates.length}. Use a busca ou filtre por cargo.</p>}
    {regional && <><div className="picker-step"><span className="step-number">02</span><h3>Quais cidades?</h3><span className="small muted">{cities.length} selecionadas</span></div><label className="search"><Search size={16} /><input aria-label={`Buscar cidade de ${uf.toUpperCase()}`} placeholder={`Buscar cidade em ${uf.toUpperCase()}`} value={cityQuery} onChange={e=>setCityQuery(e.target.value)} /></label>
    {cities.length>0 && <div className="city-chips">{cities.map(code=><button key={code} onClick={()=>toggleCity(code)} aria-label={`Remover cidade ${municipalities.find(m=>m.code===code)?.name || code}`}>{municipalities.find(m=>m.code===code)?.name || code}<X size={12} /></button>)}</div>}
    <div className="city-options">{filteredCities.slice(0,40).map(m=><label key={m.code}><input type="checkbox" checked={cities.includes(m.code)} onChange={()=>toggleCity(m.code)} /><span>{m.name}</span></label>)}{!filteredCities.length && <p className="picker-empty muted">Nenhuma cidade encontrada.</p>}</div>
    <p className="small muted results-hint">{municipalities.length} municípios disponíveis. Cidades e candidatos já acompanhados aparecem primeiro.</p>
    {limitError && <p className="warning-text small" role="alert">{limitError}</p>}</>}
    </div><footer className="picker-footer"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="add-button" disabled={!selected.length||(regional&&!cities.length)||!!limitError} onClick={()=>onSave(proposed)}>{initial?'Salvar alterações':regional?`Adicionar ${selected.length||''} ${selected.length===1?'acompanhamento':'acompanhamentos'}`:'Adicionar candidato'}</button></footer></div>
  </dialog>;
}
export default function Watchlist({ uf='sc',snapshot, preferences, tracking, onChange, history={},historyWarning=null,view='all',officeFilter='all',pendingOnly=false }: { snapshot:ElectionSnapshot|null; preferences:WatchPreferences; tracking:Record<string,TrackedCandidate>; onChange:(p:WatchPreferences)=>void;uf?:string;view?:'all'|'candidates'|'municipal'|'comparison'|'history';officeFilter?:OfficeFilter;history?:HistoryData;historyWarning?:string|null;pendingOnly?:boolean }) {
  const [picker,setPicker]=useState<{regional:boolean;initial?:RegionalSelection}|null>(null);
  const [compact,setCompact]=useState(false);
  useEffect(()=>{void Promise.resolve().then(()=>{try{setCompact(localStorage.getItem('eleicoes-2026:compact')==='true');}catch{/* Use cards by default. */}});},[]);
  function toggleCompact(value:boolean){setCompact(value);try{localStorage.setItem('eleicoes-2026:compact',String(value));}catch{/* Current view remains usable. */}}
  const getCandidate=(s:CandidateSelection):Candidate|null=>snapshot?.[s.office].find(c=>c.id===s.candidateId)||null;
  const visibleOffice=(office:typeof OFFICES[number])=>(officeFilter==='all'||office===officeFilter)&&(!pendingOnly||snapshot?.offices[office].status!=='finished');const candidates=preferences.candidates.filter(s=>visibleOffice(s.office));
  const regional=preferences.regional.filter(s=>visibleOffice(s.office));
  const watched=watchedCandidates(snapshot,preferences).filter(c=>visibleOffice(c.office));
  function exportResults(){if(snapshot)downloadBlob(new Blob([selectedResultsCsv(snapshot,pendingOnly?{...preferences,candidates,regional}:preferences,officeFilter)],{type:'text/csv;charset=utf-8'}),`resultados-${uf}-${new Date().toISOString().slice(0,10)}.csv`);}
  function save(selections:RegionalSelection[]){
    if(!picker)return;
    if(picker.regional)onChange({...preferences,regional:applyRegionalSelections(preferences.regional,selections,!picker.initial)});
    else onChange({...preferences,candidates:[...preferences.candidates,...selections.map(s=>({office:s.office,candidateId:s.candidateId}))]});
    setPicker(null);
  }
  return <FocusPanel label="Seu acompanhamento" actions={<><button className="secondary-button" onClick={exportResults} disabled={!snapshot||!watched.length}><Download size={15}/>Exportar resultados CSV</button><div className="position-switch" role="group" aria-label="Formato dos candidatos"><button aria-pressed={!compact} onClick={()=>toggleCompact(false)}><LayoutGrid size={15}/>Cartões</button><button aria-pressed={compact} onClick={()=>toggleCompact(true)}><List size={15}/>Lista compacta</button></div></>}>
    {(view==='all'||view==='candidates')&&<><div className="section-heading" id="acompanhamento"><div><span className="section-tag">SEU PAINEL</span><h2>Candidatos que você acompanha</h2><p className="small muted section-description">{preferences.candidates.length>=50?'Limite de 50 candidatos atingido. Remova um para adicionar outro.':'Suas escolhas ficam salvas neste navegador.'}</p></div><button className="add-button" disabled={preferences.candidates.length>=50} onClick={()=>setPicker({regional:false})}><Plus size={16} /> Adicionar candidato</button></div>
    {candidates.length?compact?<section className="compact-candidates panel" aria-label="Candidatos acompanhados em lista compacta">{candidates.map(s=>{const c=getCandidate(s);return <article key={selectionKey(s)}><div><h3>{c?.name||'Candidatura indisponível'}</h3><p className="small muted">{officeLabel(s.office,uf)} · {c?.party} · {c?.number}</p><p className="small">{c?.rank?`${c.rank}º por votos`:'Aguardando apuração'} · {snapshot?.offices[s.office].seats??'—'} vagas</p><p className={c?.officialElected?'positive small':'muted small'}>{c?.officialElected?'Eleito confirmado pelo TSE':c?.officialStatus||'Eleição não confirmada'}</p></div><div className="compact-votes"><strong>{number(c?.rank?c.votes:null)}</strong><span>{percentage(c?.rank?c.percentage:null)}</span></div><div className="compact-actions">{c&&<ShareCandidate candidate={c} uf={uf} stateName={snapshot?.state.name||uf.toUpperCase()} meta={snapshot?.offices[s.office]} stale={snapshot?.stale}/>}<button className="icon-button" aria-label={`Remover ${c?.name||'candidato'} do acompanhamento`} onClick={()=>onChange({...preferences,candidates:preferences.candidates.filter(p=>selectionKey(p)!==selectionKey(s))})}><X size={17}/></button></div></article>;})}</section>:<section className="two-columns" aria-label="Candidatos acompanhados">{candidates.map(s=><TrackedCard uf={uf} stateName={snapshot?.state.name} key={selectionKey(s)} candidate={getCandidate(s)} office={s.office} data={tracking[selectionKey(s)]} meta={snapshot?.offices[s.office]} stale={snapshot?.stale} onRemove={()=>onChange({...preferences,candidates:preferences.candidates.filter(c=>selectionKey(c)!==selectionKey(s))})} />)}</section>:<div className="watch-empty panel"><div className="empty-symbol"><Plus size={23} /></div><div><h3>{officeFilter==='all'?'Quem você quer acompanhar?':'Nenhum candidato acompanhado neste cargo'}</h3><p>{officeFilter==='all'?'Adicione candidatos para ver votos e variação a cada atualização.':'Adicione um candidato ou escolha outro cargo no filtro acima.'}</p></div><button className="empty-link" onClick={()=>setPicker({regional:false})}>Escolher candidato <Plus size={15} /></button></div>}
    <p className="proportional-note"><ShieldCheck size={16} aria-hidden="true" /> Deputados são eleitos pelo sistema proporcional. A posição por votos não define a eleição.</p></>}
    {(view==='all'||view==='municipal')&&<><div className="section-heading" id="regiao"><div><span className="section-tag">VOTAÇÃO LOCAL</span><h2>Votação por município</h2><p className="small muted section-description">{preferences.regional.length>=50?'Limite de 50 acompanhamentos atingido. Remova um para adicionar outro.':'Escolha o candidato e as cidades que importam para você.'}</p></div><button className="add-button" disabled={preferences.regional.length>=50} onClick={()=>setPicker({regional:true})}><Plus size={16} /> Adicionar candidato e cidades</button></div>
    {regional.length?<section className="two-columns regional-grid" aria-label="Votação por municípios escolhidos">{regional.map(s=><RegionalChart uf={uf} key={selectionKey(s)} candidate={getCandidate(s)} office={s.office} rows={regionalRows(s,snapshot)} onEdit={()=>setPicker({regional:true,initial:s})} onRemove={()=>onChange({...preferences,regional:preferences.regional.filter(c=>selectionKey(c)!==selectionKey(s))})} />)}</section>:<div className="watch-empty panel"><div className="empty-symbol"><MapPin size={23} /></div><div><h3>{officeFilter==='all'?'Sua região, do seu jeito':'Nenhum acompanhamento municipal neste cargo'}</h3><p>{officeFilter==='all'?`Combine uma candidatura com qualquer município de ${uf.toUpperCase()}.`:'Adicione candidato e cidades ou escolha outro cargo no filtro acima.'}</p></div><button className="empty-link" onClick={()=>setPicker({regional:true})}>Escolher candidato e cidades <Plus size={15} /></button></div>}</>}
    {(view==='all'||view==='comparison')&&<CandidateComparison pendingOnly={pendingOnly} snapshot={snapshot} preferences={preferences} uf={uf} officeFilter={officeFilter}/>}
    {(view==='all'||view==='history')&&<CandidateHistory history={history} candidates={watched} uf={uf} warning={historyWarning}/>}
    {(view==='comparison'||view==='history')&&<div className="tool-actions"><button className="add-button" disabled={preferences.candidates.length>=50} onClick={()=>setPicker({regional:false})}><Plus size={16}/>Adicionar candidato</button><button className="secondary-button" onClick={()=>setPicker({regional:true})}><MapPin size={16}/>Adicionar candidato e cidades</button></div>}
    {picker && <Picker uf={uf} snapshot={snapshot} preferences={preferences} regional={picker.regional} initial={picker.initial} initialOffice={officeFilter} onClose={()=>setPicker(null)} onSave={save} />}
  </FocusPanel>;
}
