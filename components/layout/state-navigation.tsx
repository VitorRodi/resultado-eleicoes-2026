"use client";
import { useState } from "react";
import { MapPin, Globe2, Search } from "lucide-react";
import { BRAZIL_STATES } from "@/lib/brazil-states";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const states = [...BRAZIL_STATES].sort((a, b) =>
  a.name.localeCompare(b.name, "pt-BR"),
);
export default function StateNavigation({
  uf,
  onSelect,
}: {
  uf: string;
  onSelect: (uf: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = states.filter((state) =>
    normalize(`${state.uf} ${state.name}`).includes(normalize(query)),
  );
  return (
    <aside className="state-sidebar" aria-label="Seleção de resultados">
      <div className="state-navigation-heading">
        <MapPin size={23} aria-hidden="true" />
        <div>
          <span className="section-tag">Eleições 2026</span>
          <h2>Seu lugar na apuração</h2>
        </div>
      </div>
      <label className="mobile-state-selector">
        Local
        <select
          aria-label="Selecionar estado"
          value={uf}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="br">Brasil · Presidente</option>
          {states.map((s) => (
            <option key={s.uf} value={s.uf.toLowerCase()}>
              {s.uf} · {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="desktop-geography">
        <button
          className="general-navigation"
          aria-current={uf === "br" ? "page" : undefined}
          onClick={() => onSelect("br")}
        >
          <Globe2 size={19} aria-hidden="true" />
          Geral · Brasil
        </button>
        <label className="state-search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Buscar estado"
            placeholder="Buscar estado ou UF"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <p className="state-list-label">Resultados por estado</p>
      </div>
      <nav className="state-navigation" aria-label="Estados do Brasil">
        {filtered.map((s) => (
          <button
            key={s.uf}
            aria-current={uf === s.uf.toLowerCase() ? "page" : undefined}
            onClick={() => onSelect(s.uf.toLowerCase())}
          >
            <span>{s.uf}</span>
            {s.name}
          </button>
        ))}
        {!filtered.length && (
          <p className="small muted">Nenhum estado encontrado.</p>
        )}
      </nav>
      <p className="small muted state-navigation-note">
        Seus candidatos e cidades ficam salvos neste navegador, separadamente
        por estado.
      </p>
    </aside>
  );
}
