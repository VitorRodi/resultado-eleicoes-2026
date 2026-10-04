'use client';
import { LayoutGrid, ListOrdered, MapPin, Users, Map, ShieldCheck, RotateCcw, SlidersHorizontal, ArrowLeftRight, History } from 'lucide-react';
import { officeLabel } from '@/lib/config';
import { OFFICES, type Office } from '@/types/election';
export type PanelView='all'|'results'|'candidates'|'municipal'|'map'|'sources'|'comparison'|'history'|'parties';
export type OfficeFilter='all'|Office;
const views=[
  {id:'all',label:'Tudo',icon:LayoutGrid},
  {id:'results',label:'Resultados por cargo',icon:ListOrdered},
  {id:'candidates',label:'Meus candidatos',icon:Users},
  {id:'municipal',label:'Municípios',icon:MapPin},
  {id:'comparison',label:'Comparar candidatos',icon:ArrowLeftRight},
  {id:'history',label:'Histórico',icon:History},
  {id:'parties',label:'Partidos e federações',icon:Users},
  {id:'map',label:'Mapa da apuração',icon:Map},
  {id:'sources',label:'Fontes',icon:ShieldCheck},
] as const;
export default function PanelFilters({uf,stateName,view,office,onViewChange,onOfficeChange,onReset}:{uf:string;stateName:string;view:PanelView;office:OfficeFilter;onViewChange:(view:PanelView)=>void;onOfficeChange:(office:OfficeFilter)=>void;onReset:()=>void}){
  const canFilterOffice=!['map','sources'].includes(view),filtered=view!=='all'||office!=='all';
  return <section className="panel-filters panel" id="filtros-painel" aria-labelledby="panel-filters-title">
    <div className="panel-filters-heading"><div><SlidersHorizontal size={17} aria-hidden="true"/><h2 id="panel-filters-title">Explore {stateName}</h2></div>{filtered&&<button className="reset-panel-filters" onClick={onReset}><RotateCcw size={13} aria-hidden="true"/>Limpar filtros</button>}</div>
    <nav className="panel-resource-filters" aria-label="Filtrar recursos do painel">{views.map(item=><button key={item.id} aria-pressed={view===item.id} onClick={()=>onViewChange(item.id)}><item.icon size={15} aria-hidden="true"/>{item.label}</button>)}</nav>
    <div className="panel-filter-options">{canFilterOffice&&<label>Cargo<select aria-label="Filtrar por cargo" value={office} onChange={e=>onOfficeChange(e.target.value as OfficeFilter)}><option value="all">Todos os cargos</option>{OFFICES.map(o=><option key={o} value={o}>{officeLabel(o,uf)}</option>)}</select></label>}<p className="small muted" role="status">{filtered?`Mostrando: ${views.find(v=>v.id===view)!.label}${canFilterOffice&&office!=='all'?` · ${officeLabel(office,uf)}`:''}`:'Escolha um recurso ou cargo para encontrar o que você precisa.'}</p></div>
  </section>;
}
