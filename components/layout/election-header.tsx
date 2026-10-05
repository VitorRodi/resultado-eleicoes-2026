import { ExternalLink, Radio } from "lucide-react";
export default function ElectionHeader({
  uf,
  name,
  finished,
  warning,
}: {
  uf: string;
  name: string;
  finished?: boolean;
  warning?: boolean;
}) {
  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <span>Eleições 2026 · 1º turno</span>
          <span>4 de outubro</span>
          <a
            href="https://resultados.tse.jus.br/"
            target="_blank"
            rel="noreferrer"
          >
            Portal oficial do TSE <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
      <header className="container masthead">
        <div className="brand">
          <div className="sc-mark" aria-hidden="true">
            {uf.toUpperCase()}
          </div>
          <div>
            <p className="eyebrow">Resultados · Eleições 2026</p>
            <h1>{name}</h1>
            <p className="masthead-description">
              Candidatos, cidades e resultados em um só lugar.
            </p>
          </div>
        </div>
        <div className="live-block">
          <span className={`live-badge ${warning ? "live-warning" : ""}`}>
            <Radio size={15} aria-hidden="true" />
            {finished
              ? "Totalização final"
              : warning
                ? "Atualização com aviso"
                : "Atualização automática"}
          </span>
          <p className="small muted">Dados do TSE · painel independente</p>
        </div>
      </header>
    </>
  );
}
