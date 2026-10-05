import {
  ArrowRight,
  Users,
  MapPin,
  FileSpreadsheet,
  Map,
  ListOrdered,
} from "lucide-react";
import type { PanelView } from "./panel-filters";
const actions = [
  {
    view: "candidates",
    label: "Meus candidatos",
    description: "Votos, posição e situação dos candidatos que você acompanha.",
    icon: Users,
  },
  {
    view: "municipal",
    label: "Votos nas cidades",
    description:
      "Compare a votação dos seus candidatos nos municípios escolhidos.",
    icon: MapPin,
  },
  {
    view: "excel",
    label: "Excel por cidade",
    description: "Escolha um candidato e baixe sua votação por município.",
    icon: FileSpreadsheet,
  },
  {
    view: "map",
    label: "Mapa da apuração",
    description: "Explore a liderança e as seções apuradas em cada estado.",
    icon: Map,
  },
] as const;
export default function PanelOverview({
  stateName,
  onViewChange,
}: {
  stateName: string;
  onViewChange: (view: PanelView) => void;
}) {
  return (
    <section className="overview-section" aria-labelledby="overview-title">
      <div className="section-heading">
        <div>
          <span className="section-tag">Seu caminho pela apuração</span>
          <h2 id="overview-title">O que você quer acompanhar?</h2>
          <p className="section-description muted">
            Comece por {stateName}. Explore os detalhes no seu ritmo.
          </p>
        </div>
      </div>
      <div className="overview-actions">
        {actions.map((action) => (
          <button
            className="overview-action"
            key={action.view}
            onClick={() => onViewChange(action.view)}
          >
            <span className="overview-icon">
              <action.icon size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        className="overview-results text-link"
        onClick={() => onViewChange("results")}
      >
        <ListOrdered size={18} aria-hidden="true" />
        Consultar os resultados por cargo{" "}
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
