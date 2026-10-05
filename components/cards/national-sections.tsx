import {number,clock} from '@/lib/formatting';
import {remainingSections} from '@/lib/live-features';
import type {NationalPresidentSnapshot} from '@/types/election';
export default function NationalSections({data}:{data:NationalPresidentSnapshot|null}){
  return <section className="national-sections panel" aria-labelledby="national-sections-title"><div><span className="section-tag">BRASIL E EXTERIOR · PRESIDENTE</span><h2 id="national-sections-title">Quantas seções faltam no país?</h2><p className="small muted">Dados TSE: {clock(data?.meta.updatedAt||null)}{data?.stale?' · último resultado válido':''}</p></div><dl><div><dt>Apuradas</dt><dd>{number(data?.meta.sections)}</dd></div><div><dt>Faltam apurar</dt><dd>{number(remainingSections(data?.meta))}</dd></div><div><dt>Total de seções</dt><dd>{number(data?.meta.totalSections)}</dd></div></dl></section>;
}
