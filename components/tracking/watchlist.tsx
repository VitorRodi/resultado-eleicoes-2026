'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Plus, Search, ShieldCheck, X } from 'lucide-react';
import Avatar from '@/components/cards/avatar';
import TrackedCard from './tracked-card';
import RegionalChart from '@/components/charts/regional-chart';
import { officeLabel, canonical } from '@/lib/config';
import { applyRegionalSelections, regionalRows, selectionKey } from '@/lib/preferences';
import { OFFICES, type Candidate, type CandidateSelection, type ElectionSnapshot, type RegionalSelection, type TrackedCandidate, type WatchPreferences } from '@/types/election';

function Picker({ uf='sc',snapshot, preferences, regional, initial, onClose, onSave }: { snapshot:ElectionSnapshot|null; preferences:WatchPreferences; regional:boolean; initial?:RegionalSelection; onClose:()=>void; onSave:(s:RegionalSelection[])=>void;uf?:string }) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [office,setOffice]=useState('all'),[query,setQuery]=useState(''),[cityQuery,setCityQuery]=useState('');
  const [selected,setSelected]=useState<CandidateSelection[]>(initial?[initial]:[]),[cities,setCities]=useState<string[]>(initial?.municipalityCodes || []);
  const multiple=regional&&!initial;
  const all=snapshot?OFFICES.flatMap(o=>snapshot[o]):[];
  const candidates=all.filter(c=>(office==='all'||c.office===office) && (canonical(`${c.name} ${c.fullName}`).includes(canonical(query))||c.number.includes(query.trim()))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const selectedCandidates=all.filter(c=>selected.some(s=>selectionKey({office:c.office,candidateId:c.id})===selectionKey(s)));
  const existing=regional?preferences.regional:preferences.candidates;
  const municipalities=snapshot?.municipalities || [];
  const filteredCities=municipalities.filter(m=>canonical(m.name).includes(canonical(cityQuery)));
  const proposed=selected.map(s=>({...s,municipalityCodes:cities}));
  let limitError='';
  if(regional)try{applyRegionalSelections(preferences.regional,proposed,multiple);}catch(error){limitError=error instanceof Error?error.message:'Limite de acompanhamentos atingido.';}
  function toggleCandidate(s:CandidateSelection){setSelected(current=>multiple?current.some(c=>selectionKey(c)===selectionKey(s))?current.filter(c=>selectionKey(c)!==selectionKey(s)):[...current,s]:[s]);}
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  function toggleCity(code:string){setCities(current=>current.includes(code)?current.filter(c=>c!==code):[...current,code]);}
  return <dialog ref={dialog} className="picker-dialog" aria-labelledby="picker-title" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose();}}>
    <div className="picker-shell"><header className="picker-header"><div><span className="section-tag">MONTE SEU ACOMPANHAMENTO</span><h2 id="picker-title">{initial?'Editar candidato e cidades':regional?'Adicionar candidatos e cidades':'Adicionar candidato'}</h2><p className="small muted">{multiple?'Selecione vários candidatos. As cidades escolhidas serão acrescentadas a todos.':regional?`Escolha uma candidatura e os municípios de ${uf.toUpperCase()}.`:'Escolha entre as candidaturas oficiais dos cinco cargos.'}</p></div><button className="icon-button" onClick={onClose} aria-label="Fechar seleção"><X size={20} /></button></header>
    <div className="picker-body"><div className="picker-step"><span className="step-number">01</span><h3>Qual candidato?</h3></div>
    <div className="picker-filters"><label className="search"><Search size={16} /><input autoFocus aria-label="Buscar candidato para acompanhar" placeholder="Nome ou número do candidato" value={query} onChange={e=>setQuery(e.target.value)} /></label><select aria-label="Filtrar candidatos por cargo" value={office} onChange={e=>setOffice(e.target.value)}><option value="all">Todos os cargos</option>{OFFICES.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></div>
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
    <p className="small muted results-hint">{municipalities.length} municípios disponíveis. Cada candidato pode ter cidades diferentes.</p>
    {limitError && <p className="warning-text small" role="alert">{limitError}</p>}</>}
    </div><footer className="picker-footer"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="add-button" disabled={!selected.length||(regional&&!cities.length)||!!limitError} onClick={()=>onSave(proposed)}>{initial?'Salvar alterações':regional?`Adicionar ${selected.length||''} ${selected.length===1?'acompanhamento':'acompanhamentos'}`:'Adicionar candidato'}</button></footer></div>
  </dialog>;
}
export default function Watchlist({ uf='sc',snapshot, preferences, tracking, onChange }: { snapshot:ElectionSnapshot|null; preferences:WatchPreferences; tracking:Record<string,TrackedCandidate>; onChange:(p:WatchPreferences)=>void;uf?:string }) {
  const [picker,setPicker]=useState<{regional:boolean;initial?:RegionalSelection}|null>(null);
  const getCandidate=(s:CandidateSelection):Candidate|null=>snapshot?.[s.office].find(c=>c.id===s.candidateId)||null;
  function save(selections:RegionalSelection[]){
    if(!picker)return;
    if(picker.regional)onChange({...preferences,regional:applyRegionalSelections(preferences.regional,selections,!picker.initial)});
    else onChange({...preferences,candidates:[...preferences.candidates,...selections.map(s=>({office:s.office,candidateId:s.candidateId}))]});
    setPicker(null);
  }
  return <>
    <div className="section-heading" id="acompanhamento"><div><span className="section-tag">SEU PAINEL</span><h2>Candidatos que você acompanha</h2><p className="small muted section-description">{preferences.candidates.length>=50?'Limite de 50 candidatos atingido. Remova um para adicionar outro.':'Suas escolhas ficam salvas neste navegador.'}</p></div><button className="add-button" disabled={preferences.candidates.length>=50} onClick={()=>setPicker({regional:false})}><Plus size={16} /> Adicionar candidato</button></div>
    {preferences.candidates.length?<section className="two-columns" aria-label="Candidatos acompanhados">{preferences.candidates.map(s=><TrackedCard uf={uf} stateName={snapshot?.state.name} key={selectionKey(s)} candidate={getCandidate(s)} office={s.office} data={tracking[selectionKey(s)]} meta={snapshot?.offices[s.office]} onRemove={()=>onChange({...preferences,candidates:preferences.candidates.filter(c=>selectionKey(c)!==selectionKey(s))})} />)}</section>:<div className="watch-empty panel"><div className="empty-symbol"><Plus size={23} /></div><div><h3>Quem você quer acompanhar?</h3><p>Adicione candidatos para ver votos e variação a cada atualização.</p></div><button className="empty-link" onClick={()=>setPicker({regional:false})}>Escolher candidato <Plus size={15} /></button></div>}
    <p className="proportional-note"><ShieldCheck size={16} aria-hidden="true" /> Deputados são eleitos pelo sistema proporcional. A posição por votos não define a eleição.</p>
    <div className="section-heading" id="regiao"><div><span className="section-tag">VOTAÇÃO LOCAL</span><h2>Votação por município</h2><p className="small muted section-description">{preferences.regional.length>=50?'Limite de 50 acompanhamentos atingido. Remova um para adicionar outro.':'Escolha o candidato e as cidades que importam para você.'}</p></div><button className="add-button" disabled={preferences.regional.length>=50} onClick={()=>setPicker({regional:true})}><Plus size={16} /> Adicionar candidato e cidades</button></div>
    {preferences.regional.length?<section className="two-columns regional-grid" aria-label="Votação por municípios escolhidos">{preferences.regional.map(s=><RegionalChart uf={uf} key={selectionKey(s)} candidate={getCandidate(s)} office={s.office} rows={regionalRows(s,snapshot)} onEdit={()=>setPicker({regional:true,initial:s})} onRemove={()=>onChange({...preferences,regional:preferences.regional.filter(c=>selectionKey(c)!==selectionKey(s))})} />)}</section>:<div className="watch-empty panel"><div className="empty-symbol"><MapPin size={23} /></div><div><h3>Sua região, do seu jeito</h3><p>Combine uma candidatura com qualquer município de {uf.toUpperCase()}.</p></div><button className="empty-link" onClick={()=>setPicker({regional:true})}>Escolher candidato e cidades <Plus size={15} /></button></div>}
    {picker && <Picker uf={uf} snapshot={snapshot} preferences={preferences} regional={picker.regional} initial={picker.initial} onClose={()=>setPicker(null)} onSave={save} />}
  </>;
}
