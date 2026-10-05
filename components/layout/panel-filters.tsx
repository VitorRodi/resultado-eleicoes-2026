"use client";
import {
  LayoutGrid,
  MapPin,
  Users,
  Map,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { officeLabel } from "@/lib/config";
import { OFFICES, type Office } from "@/types/election";
export type PanelView =
  | "overview"
  | "all"
  | "results"
  | "candidates"
  | "municipal"
  | "map"
  | "sources"
  | "comparison"
  | "history"
  | "parties"
  | "turnout"
  | "alerts"
  | "municipalMap"
  | "excel";
export type OfficeFilter = "all" | Office;
const groups = [
  {
    label: "Resumo",
    icon: LayoutGrid,
    items: [
      { id: "overview", label: "Resumo" },
      { id: "all", label: "Ver tudo" },
    ],
  },
  {
    label: "Candidatos",
    icon: Users,
    items: [
      { id: "candidates", label: "Meus candidatos" },
      { id: "results", label: "Resultados por cargo" },
      { id: "comparison", label: "Comparar candidatos" },
      { id: "history", label: "Histórico" },
      { id: "parties", label: "Partidos e federações" },
      { id: "alerts", label: "Avisos" },
    ],
  },
  {
    label: "Municípios",
    icon: MapPin,
    items: [
      { id: "municipal", label: "Votos nas cidades" },
      { id: "excel", label: "Excel por cidade" },
      { id: "municipalMap", label: "Mapa dos municípios" },
    ],
  },
  {
    label: "Apuração",
    icon: Map,
    items: [
      { id: "map", label: "Mapa da apuração" },
      { id: "turnout", label: "Votantes e nulos" },
    ],
  },
  {
    label: "Fontes",
    icon: ShieldCheck,
    items: [{ id: "sources", label: "Fontes" }],
  },
] satisfies {
  label: string;
  icon: typeof LayoutGrid;
  items: { id: PanelView; label: string }[];
}[];
export default function PanelFilters({
  uf,
  stateName,
  view,
  office,
  onViewChange,
  onOfficeChange,
  onReset,
  pending,
  onPending,
}: {
  uf: string;
  stateName: string;
  view: PanelView;
  office: OfficeFilter;
  onViewChange: (view: PanelView) => void;
  onOfficeChange: (office: OfficeFilter) => void;
  onReset: () => void;
  pending: boolean;
  onPending: (v: boolean) => void;
}) {
  const active = groups.find((group) =>
    group.items.some((item) => item.id === view),
  )!;
  const canFilterOffice = ![
      "overview",
      "map",
      "sources",
      "alerts",
      "municipalMap",
      "excel",
    ].includes(view),
    filtered = office !== "all" || pending;
  return (
    <section
      className="panel-filters panel"
      id="filtros-painel"
      aria-labelledby="panel-filters-title"
    >
      <div className="panel-filters-heading">
        <h2 id="panel-filters-title">Explore {stateName}</h2>
        {filtered && (
          <button className="reset-panel-filters" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            Limpar filtros
          </button>
        )}
      </div>
      <nav className="primary-resource-nav" aria-label="Recursos do painel">
        {groups.map((group) => (
          <button
            key={group.label}
            aria-pressed={active === group}
            onClick={() => onViewChange(group.items[0].id)}
          >
            <group.icon size={18} aria-hidden="true" />
            {group.label}
          </button>
        ))}
      </nav>
      {active.items.length > 1 && (
        <nav
          className="panel-resource-filters"
          aria-label="Filtrar recursos do painel"
        >
          {active.items
            .filter((item) => item.id !== "overview")
            .map((item) => (
              <button
                key={item.id}
                aria-pressed={view === item.id}
                onClick={() => onViewChange(item.id)}
              >
                {item.label}
              </button>
            ))}
        </nav>
      )}
      {canFilterOffice && (
        <div className="panel-filter-options">
          <label>
            Cargo
            <select
              aria-label="Filtrar por cargo"
              value={office}
              onChange={(e) => onOfficeChange(e.target.value as OfficeFilter)}
            >
              <option value="all">Todos os cargos</option>
              {OFFICES.map((o) => (
                <option key={o} value={o}>
                  {officeLabel(o, uf)}
                </option>
              ))}
            </select>
          </label>
          <label className="pending-toggle">
            <input
              type="checkbox"
              checked={pending}
              onChange={(e) => onPending(e.target.checked)}
            />
            Somente cargos ainda em apuração
          </label>
        </div>
      )}
      <span className="sr-only" role="status">
        Mostrando: {active.items.find((item) => item.id === view)?.label}
      </span>
    </section>
  );
}
