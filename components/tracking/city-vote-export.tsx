"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Download, LoaderCircle, Search, X } from "lucide-react";
import { OFFICES, type Office, type ElectionSnapshot, type Municipality } from "@/types/election";
import { officeLabel } from "@/lib/config";
import type { CityResults } from "@/lib/city-results";
import { findCities, findCityCandidates } from "@/lib/city-vote-query";
import { requestCityVotes } from "@/lib/city-vote-request";
import { number } from "@/lib/formatting";
import { downloadBlob } from "@/lib/download";

const PAGE_SIZE = 30;
const SUGGESTION_LIMIT = 12;

export default function CityVoteExport({ uf, snapshot }: {
  uf: string;
  snapshot: ElectionSnapshot | null;
}) {
  const [office, setOffice] = useState<Office>("president");
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<CityResults | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<"consult" | "download" | null>(null);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [order, setOrder] = useState<"votes" | "name">("votes");
  const [page, setPage] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const hintId = useId();
  useEffect(() => () => controller.current?.abort(), []);

  const cities = useMemo(() => findCities(snapshot?.municipalities || [], query), [snapshot?.municipalities, query]);
  const suggestions = cities.slice(0, SUGGESTION_LIMIT);
  const selected = snapshot?.municipalities.find(m => m.code === city);
  const candidates = useMemo(() => findCityCandidates(result?.candidates || [], candidateQuery, order), [result?.candidates, candidateQuery, order]);
  const pages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const displayed = candidates.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const active = Math.min(activeIndex, suggestions.length - 1);
  const activeOptionId = open && active >= 0 ? `${listId}-${suggestions[active].code}` : undefined;
  useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setPhase(null);
    setResult(null);
    setMessage("");
    setFailed(false);
    setCandidateQuery("");
    setPage(0);
  }
  function chooseCity(municipality: Municipality) {
    reset();
    setCity(municipality.code);
    setQuery(municipality.name);
    setOpen(false);
    setActiveIndex(0);
  }
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setPhase(null);
    setFailed(false);
    setMessage("Consulta cancelada. Você pode escolher outra cidade ou tentar novamente.");
  }
  async function consult(format?: "xlsx") {
    if (!selected || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]);
    setPhase(format ? "download" : "consult");
    setFailed(false);
    setOpen(false);
    setMessage(format ? "Preparando o Excel com todos os candidatos…" : `Consultando ${selected.name} · ${officeLabel(office, uf)}…`);
    try {
      const data = await requestCityVotes({ uf, office, city }, signal, format);
      // Cancelled requests must never overwrite a new selection or download an old file.
      if (controller.current !== abort || signal.aborted) return;
      if (data instanceof Blob) {
        downloadBlob(data, `votos-${uf}-${city}-${office}-2026.xlsx`);
        setMessage("Excel baixado com todos os candidatos e votos desta cidade.");
      } else {
        setResult(data);
        setPage(0);
        setMessage(data.stale ? "Último resultado disponível; a atualização falhou." :
          data.status === "waiting" ? "Aguardando divulgação dos votos." :
          data.status === "unavailable" ? "A divulgação dos votos deste cargo está indisponível." :
          `${data.candidates.length} candidatos consultados. Busque por nome, número ou partido abaixo.`);
      }
    } catch (error) {
      if (controller.current !== abort || abort.signal.aborted) return;
      setFailed(true);
      setMessage(signal.aborted ? "A consulta demorou mais que o esperado. Tente novamente ou escolha outra cidade." :
        error instanceof Error ? error.message : "Não foi possível consultar. Tente novamente.");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setPhase(null);
      }
    }
  }

  return (
    <section className="analysis-panel panel city-vote-export" aria-labelledby="city-export-title">
      <header className="analysis-heading">
        <div>
          <span className="section-tag">Lista de votação · {uf.toUpperCase()}</span>
          <h2 id="city-export-title">Todos os candidatos em uma cidade</h2>
          <p className="muted">Digite o nome da cidade, selecione uma sugestão e escolha o cargo.</p>
        </div>
      </header>
      <form onSubmit={event => { event.preventDefault(); void consult(); }}>
        <div className="city-vote-fields">
          <div className="city-search-field" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}>
            <label htmlFor={`${listId}-input`}>Cidade</label>
            <div className="city-search-control">
            <div className="search">
              <Search size={16} aria-hidden="true" />
              <input ref={input} id={`${listId}-input`} role="combobox"
                aria-label="Buscar cidade para lista de votos" aria-autocomplete="list"
                aria-expanded={open} aria-controls={listId} aria-describedby={hintId}
                aria-activedescendant={activeOptionId}
                autoComplete="off" placeholder="Ex.: Caibi ou São Carlos" value={query}
                onFocus={() => { setOpen(true); setActiveIndex(0); }}
                onChange={event => { reset(); setCity(""); setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
                onKeyDown={event => {
                  if (event.key === "Escape") { setOpen(false); return; }
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault(); setOpen(true);
                    setActiveIndex(Math.max(0, Math.min(suggestions.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1))));
                  } else if (event.key === "Enter" && open) {
                    event.preventDefault();
                    if (suggestions[active]) chooseCity(suggestions[active]);
                  }
                }} />
              {query && <button type="button" className="city-search-clear" aria-label="Limpar cidade" onClick={() => {
                reset(); setCity(""); setQuery(""); setOpen(true); setActiveIndex(0); input.current?.focus();
              }}><X size={16} aria-hidden="true" /></button>}
            </div>
            {open && <div className="city-suggestions">
              <ul id={listId} role="listbox" aria-label="Cidades encontradas">
                {suggestions.map((municipality, index) => <li key={municipality.code} id={`${listId}-${municipality.code}`}
                  role="option" aria-selected={index === active}>
                  <button type="button" tabIndex={-1} onMouseDown={event => event.preventDefault()}
                    onClick={() => chooseCity(municipality)}>
                    <span>{municipality.name}</span><small>{uf.toUpperCase()}</small>
                  </button>
                </li>)}
              </ul>
              <p className="small muted">{!snapshot?.municipalities.length ? "Carregando as cidades do estado…" :
                !cities.length ? "Nenhuma cidade encontrada. Confira o nome ou digite só uma parte." :
                cities.length > SUGGESTION_LIMIT ? `${cities.length} cidades encontradas. Digite mais para refinar a busca.` :
                "Clique em uma cidade ou use as setas e Enter."}</p>
            </div>}
            </div>
            <p id={hintId} className="small muted city-search-hint">
              {selected ? `Cidade selecionada: ${selected.name} · ${uf.toUpperCase()}` : "Você pode pesquisar sem acentos. Selecione uma cidade para continuar."}
            </p>
          </div>
          <label className="city-office-field">Cargo
            <select aria-label="Cargo para lista de votos" value={office} onChange={event => {
              reset(); setOffice(event.target.value as Office);
            }}>
              {OFFICES.map(o => <option key={o} value={o}>{officeLabel(o, uf)}</option>)}
            </select>
          </label>
        </div>
        <div className="tool-actions">
          <button type="submit" className="add-button" disabled={!selected || !!phase}>
            {phase === "consult" && <LoaderCircle size={16} className="city-loading-icon" aria-hidden="true" />}
            {phase === "consult" ? "Consultando votos…" : "Ver votos na cidade"}
          </button>
          <button type="button" className="secondary-button" disabled={!selected || !!phase}
            onClick={() => void consult("xlsx")}>
            <Download size={16} aria-hidden="true" />
            {phase === "download" ? "Preparando Excel…" : "Baixar lista em Excel"}
          </button>
          {phase && <button type="button" className="secondary-button" onClick={cancel}>Cancelar consulta</button>}
        </div>
      </form>
      <p className={`small city-query-status ${failed ? "negative" : "muted"}`} role="status" aria-live="polite">
        {message || "Primeiro turno de 2026. O Excel inclui a lista completa de candidatos e votos, mesmo quando você filtra a tela."}
      </p>
      {result && <div className="city-vote-results" aria-busy={phase === "consult"}>
        <div className="city-result-heading">
          <div><h3>{result.municipality.name} · {uf.toUpperCase()}</h3>
            <p className="small muted">{officeLabel(result.office, uf)}{result.status === "counting" ? " · apuração parcial" : ""}</p>
          </div>
          <span className="small muted">{result.candidates.length} candidatos</span>
        </div>
        <div className="city-vote-fields city-result-filters">
          <label>Buscar nesta lista
            <span className="search"><Search size={16} aria-hidden="true" />
              <input aria-label="Buscar candidato na cidade" placeholder="Nome, número ou partido" value={candidateQuery}
                onChange={event => { setCandidateQuery(event.target.value); setPage(0); }} />
              {candidateQuery && <button type="button" className="city-search-clear" aria-label="Limpar busca de candidato"
                onClick={() => { setCandidateQuery(""); setPage(0); }}><X size={16} aria-hidden="true" /></button>}
            </span>
          </label>
          <label>Ordenar por
            <select aria-label="Ordenar candidatos na cidade" value={order} onChange={event => {
              setOrder(event.target.value as "votes" | "name"); setPage(0);
            }}><option value="votes">Mais votados</option><option value="name">Nome do candidato</option></select>
          </label>
        </div>
        <p className="small muted" role="status">{candidates.length ?
          `${currentPage * PAGE_SIZE + 1} a ${Math.min((currentPage + 1) * PAGE_SIZE, candidates.length)} de ${candidates.length} ${candidates.length === 1 ? "candidato" : "candidatos"}${candidateQuery ? candidates.length === 1 ? " encontrado" : " encontrados" : ""}.` :
          candidateQuery ? "Nenhum candidato encontrado. Tente outro nome, número ou partido." : "Não há candidatos disponíveis nesta consulta."}</p>
        {displayed.length > 0 && <div className="report-table" tabIndex={0} role="region" aria-label="Lista de votos na cidade">
          <table>
            <caption>{result.municipality.name} · {officeLabel(result.office, uf)}</caption>
            <thead><tr><th scope="col">Candidato</th><th scope="col">Votos</th></tr></thead>
            <tbody>{displayed.map(candidate => <tr key={candidate.id}>
              <td>{candidate.name}<span className="muted small">{candidate.party} · {candidate.number}</span></td>
              <td>{number(candidate.votes)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {pages > 1 && <nav className="city-vote-pagination" aria-label="Páginas dos candidatos na cidade">
          <button className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
          <span className="small muted">Página {currentPage + 1} de {pages}</span>
          <button className="secondary-button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button>
        </nav>}
      </div>}
      <p className="report-credit small">Feito por <strong>Vitor Rodi</strong> ·{" "}
        <a href="https://br.linkedin.com/in/vitor-rodi" target="_blank" rel="noreferrer">LinkedIn</a>
      </p>
    </section>
  );
}
