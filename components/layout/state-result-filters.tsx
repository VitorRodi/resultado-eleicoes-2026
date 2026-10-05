'use client';
import type {StateSort} from '@/lib/live-features';
export default function StateResultFilters({sort,pending,onSort,onPending,label}:{sort:StateSort;pending:boolean;onSort:(v:StateSort)=>void;onPending:(v:boolean)=>void;label:string}){
  return <div className="state-result-filters"><label>Ordenar estados<select aria-label={label} value={sort} onChange={e=>onSort(e.target.value as StateSort)}><option value="alphabetical">Ordem alfabética</option><option value="remaining">Mais seções pendentes</option><option value="most">Maior percentual apurado</option><option value="least">Menor percentual apurado</option></select></label><label className="pending-toggle"><input type="checkbox" checked={pending} onChange={e=>onPending(e.target.checked)}/>Somente estados ainda em apuração</label></div>;
}
