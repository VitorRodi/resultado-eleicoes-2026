import { ASSOCIATIONS_SOURCE, SC_ASSOCIATIONS } from "@/lib/sc-associations";

export default function AssociationPicker({ value, onChange, disabled = false, manual = true, separate = false, onSeparateChange }: {
  value: string; onChange: (region: string) => void; disabled?: boolean; manual?: boolean;
  separate?: boolean; onSeparateChange?: (separate: boolean) => void;
}) {
  return <div className="association-picker">
    <label className="report-field">Região / associação de municípios
      <select aria-label="Selecionar região de Santa Catarina" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">{manual ? "Escolher cidades manualmente" : "Selecione uma região"}</option>
        <option value="all">Todas as regiões · 295 municípios</option>
        {SC_ASSOCIATIONS.map(region => <option key={region.id} value={region.id}>{region.id} · {region.name.replace(/^Associação dos Municípios (do |da |de |dos )?/, "")} ({region.municipalities.length} cidades)</option>)}
      </select>
    </label>
    <p className="small muted">Escolha uma região para selecionar suas cidades. O Excel inclui a coluna Região e uma aba com os totais por associação. <a href={ASSOCIATIONS_SOURCE} target="_blank" rel="noreferrer">Consultar associações e municípios</a>.</p>
    {onSeparateChange && <>
      <label className="pending-toggle"><input type="checkbox" checked={separate} disabled={disabled} onChange={event => onSeparateChange(event.target.checked)} />Separar relatório por região</label>
      <p className="small muted">Cada região terá sua própria aba no Excel. No PDF, cada associação começa em uma nova página, com suas cidades e totais. Para incluir todas, selecione “Todas as regiões”.</p>
    </>}
  </div>;
}
