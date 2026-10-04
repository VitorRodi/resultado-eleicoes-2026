'use client';
import { MapPin } from 'lucide-react';
import { BRAZIL_STATES } from '@/lib/brazil-states';
export default function StateNavigation({uf,onSelect}:{uf:string;onSelect:(uf:string)=>void}){
  const states=[...BRAZIL_STATES].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  return <aside className="state-sidebar" aria-label="Seleção de estado"><div className="state-navigation-heading"><MapPin size={20}/><div><span className="section-tag">ELEIÇÕES 2026</span><h2>Escolha o estado</h2></div></div><label className="mobile-state-selector">Resultados por estado<select aria-label="Selecionar estado" value={uf} onChange={e=>onSelect(e.target.value)}>{states.map(s=><option key={s.uf} value={s.uf.toLowerCase()}>{s.uf} · {s.name}</option>)}</select></label><nav className="state-navigation" aria-label="Estados do Brasil">{states.map(s=><button key={s.uf} aria-current={uf===s.uf.toLowerCase()?'page':undefined} onClick={()=>onSelect(s.uf.toLowerCase())}><span>{s.uf}</span>{s.name}</button>)}</nav><p className="small muted state-navigation-note">Resultados oficiais da UF selecionada. Suas escolhas são salvas separadamente em cada estado.</p></aside>;
}
