"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { OFFICES, type Office, type ElectionSnapshot } from "@/types/election";
import { canonical, officeLabel } from "@/lib/config";
import { cityResultsSchema, type CityResults } from "@/lib/city-results";
import { number } from "@/lib/formatting";
import { downloadBlob } from "@/lib/download";
export default function CityVoteExport({
  uf,
  snapshot,
}: {
  uf: string;
  snapshot: ElectionSnapshot | null;
}) {
  const [office, setOffice] = useState<Office>("president"),
    [city, setCity] = useState(""),
    [query, setQuery] = useState("");
  const [result, setResult] = useState<CityResults | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const cities = (snapshot?.municipalities || []).filter((city) =>
    canonical(city.name).includes(canonical(query)),
  );
  const selected = snapshot?.municipalities.find((m) => m.code === city);
  function reset() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setResult(null);
    setMessage("");
  }
  async function consult(format?: "xlsx") {
    if (!city || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setMessage("Consultando a votação da cidade…");
    try {
      const params = new URLSearchParams({
        uf,
        office,
        city,
        ...(format ? { format } : {}),
      });
      const response = await fetch(`/api/elections/municipal/list?${params}`, {
        cache: "no-store",
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Consulta indisponível.");
      }
      if (abort.signal.aborted || controller.current !== abort) return;
      if (format) {
        downloadBlob(
          await response.blob(),
          `votos-${uf}-${city}-${office}-2026.xlsx`,
        );
        setMessage(
          "Excel baixado com a lista de candidatos e votos nesta cidade.",
        );
      } else {
        const data = cityResultsSchema.parse(await response.json());
        if (
          data.uf !== uf ||
          data.office !== office ||
          data.municipality.code !== city
        )
          throw new Error("Resultado de outra cidade rejeitado.");
        setResult(data);
        setMessage(
          data.stale
            ? "Último resultado disponível; a atualização falhou."
            : data.status === "waiting"
              ? "Aguardando divulgação dos votos."
              : "Lista de candidatos consultada.",
        );
      }
    } catch (error) {
      if (!abort.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar. Tente novamente.",
        );
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="analysis-panel panel city-vote-export"
      aria-labelledby="city-export-title"
    >
      <header className="analysis-heading">
        <div>
          <span className="section-tag">Lista de votação</span>
          <h2 id="city-export-title">Todos os candidatos em uma cidade</h2>
          <p className="muted">
            Escolha a cidade e o cargo. Baixe uma lista simples com o nome de
            cada candidato e seus votos.
          </p>
        </div>
      </header>
      <div className="report-picker">
        <label>
          Buscar cidade
          <span className="search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Buscar cidade para exportar"
              placeholder="Ex.: Caibi"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </span>
        </label>
        <label>
          Cidade
          <select
            aria-label="Cidade para lista de votos"
            value={city}
            onChange={(event) => {
              reset();
              setCity(event.target.value);
            }}
          >
            <option value="">Selecione a cidade</option>
            {selected && !cities.some((m) => m.code === city) && (
              <option value={city}>{selected.name}</option>
            )}
            {cities.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cargo
          <select
            aria-label="Cargo para lista de votos"
            value={office}
            onChange={(event) => {
              reset();
              setOffice(event.target.value as Office);
            }}
          >
            {OFFICES.map((o) => (
              <option key={o} value={o}>
                {officeLabel(o, uf)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tool-actions">
        <button
          className="add-button"
          disabled={!city || busy}
          onClick={() => void consult()}
        >
          {busy ? "Consultando…" : "Ver votos na cidade"}
        </button>
        <button
          className="secondary-button"
          disabled={!city || busy}
          onClick={() => void consult("xlsx")}
        >
          <Download size={16} aria-hidden="true" />
          Baixar lista em Excel
        </button>
      </div>
      <p className="small muted" role="status">
        {message ||
          "Primeiro turno de 2026. A lista inclui todos os candidatos presentes no arquivo municipal do cargo."}
      </p>
      {result && (
        <div
          className="report-table"
          tabIndex={0}
          role="region"
          aria-label="Lista de votos na cidade"
        >
          <table>
            <caption>
              {result.municipality.name} · {officeLabel(result.office, uf)}
              {result.status === "counting" ? " · apuração parcial" : ""}
            </caption>
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Votos</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <td>
                    {candidate.name}
                    <span className="muted small">
                      {candidate.party} · {candidate.number}
                    </span>
                  </td>
                  <td>{number(candidate.votes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="report-credit small">
        Feito por <strong>Vitor Rodi</strong> ·{" "}
        <a
          href="https://br.linkedin.com/in/vitor-rodi"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
      </p>
    </section>
  );
}
