"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { OFFICES, type ElectionSnapshot, type Office } from "@/types/election";
import { officeLabel, canonical } from "@/lib/config";
import { matchesCandidate } from "@/lib/panel-tools";
import { number, percentage } from "@/lib/formatting";
import { downloadBlob } from "@/lib/download";
import { municipalDownloadName } from "@/lib/export-filenames";
import {
  initialExportRows,
  mergeExportRows,
  municipalExportSchema,
  type MunicipalExport,
  type MunicipalExportRow,
} from "@/lib/municipal-export";
import {
  historicalCandidateSchema,
  voteChange,
  type HistoricalCandidate,
  type HistoricalChoice,
} from "@/lib/historical-election";
import type { OfficeFilter } from "@/components/layout/panel-filters";

export default function MunicipalExcelExport({
  uf,
  snapshot,
  officeFilter,
}: {
  uf: string;
  snapshot: ElectionSnapshot | null;
  officeFilter: OfficeFilter;
}) {
  const [office, setOffice] = useState<Office>(
      officeFilter === "all" ? "stateDeputy" : officeFilter,
    ),
    [query, setQuery] = useState(""),
    [candidateId, setCandidateId] = useState("");
  const [result, setResult] = useState<MunicipalExport | null>(null),
    [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(0);
  const [compare, setCompare] = useState(true),
    [choices, setChoices] = useState<HistoricalChoice[]>([]),
    [historyId, setHistoryId] = useState(""),
    [history, setHistory] = useState<HistoricalCandidate | null>(null),
    [historyQuery, setHistoryQuery] = useState(""),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyMessage, setHistoryMessage] = useState("");
  const controller = useRef<AbortController | null>(null),
    historyController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      historyController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const abort = new AbortController();
    historyController.current?.abort();
    historyController.current = abort;
    void Promise.resolve().then(async () => {
      if (abort.signal.aborted) return;
      setChoices([]);
      setHistoryId("");
      setHistory(null);
      setHistoryMessage("");
      setHistoryQuery("");
      setHistoryLoading(false);
      if (!candidateId || !compare) return;
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          uf,
          office,
          candidate: candidateId,
        });
        const response = await fetch(
            `/api/elections/municipal/history?${params}`,
            { cache: "no-store", signal: abort.signal },
          ),
          data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Não foi possível consultar 2022.");
        if (
          data.uf !== uf ||
          data.year !== 2022 ||
          data.round !== 1 ||
          data.current?.id !== candidateId ||
          !Array.isArray(data.candidates)
        )
          throw new Error("Resposta histórica incorreta.");
        if (abort.signal.aborted || historyController.current !== abort) return;
        setChoices(data.candidates);
        if (data.selected) {
          const selected = historicalCandidateSchema.parse(data.selected);
          if (selected.id !== data.matchedId)
            throw new Error("Correspondência histórica inválida.");
          setHistory(selected);
          setHistoryId(selected.id);
          setHistoryMessage(
            "Correspondência encontrada pelo nome completo. Confira a candidatura de 2022 abaixo.",
          );
        } else
          setHistoryMessage(
            "Não encontramos uma correspondência automática nesta UF. Se a pessoa concorreu em 2022, confirme sua candidatura abaixo; ou gere somente os votos de 2026.",
          );
      } catch (error) {
        if (!abort.signal.aborted && historyController.current === abort)
          setHistoryMessage(
            error instanceof Error
              ? error.message
              : "2022 indisponível. Gere somente os votos de 2026.",
          );
      } finally {
        if (!abort.signal.aborted && historyController.current === abort)
          setHistoryLoading(false);
      }
    });
    return () => abort.abort();
  }, [uf, office, candidateId, compare]);
  const all = snapshot?.[office] || [],
    candidates = all
      .filter((c) => matchesCandidate(c, query))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const candidate = all.find((c) => c.id === candidateId),
    cities = snapshot?.municipalities || [];
  const filteredHistory = choices.filter((candidate) =>
    canonical(
      `${candidate.name} ${candidate.fullName} ${candidate.number} ${candidate.party}`,
    ).includes(canonical(historyQuery)),
  );
  const available =
    result?.rows.filter((row) => row.votes !== null).length || 0;
  function clearResult() {
    setResult(null);
    setMessage("");
    setDone(0);
  }
  function reset() {
    controller.current?.abort();
    controller.current = null;
    historyController.current?.abort();
    setBusy(false);
    clearResult();
    setCandidateId("");
    setHistory(null);
    setHistoryId("");
    setChoices([]);
    setHistoryLoading(false);
  }
  async function chooseHistory(id: string) {
    historyController.current?.abort();
    const abort = new AbortController();
    historyController.current = abort;
    clearResult();
    setHistory(null);
    setHistoryId(id);
    setHistoryMessage("");
    if (!id) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        uf,
        office,
        candidate: candidateId,
        history: id,
      });
      const response = await fetch(
          `/api/elections/municipal/history?${params}`,
          { cache: "no-store", signal: abort.signal },
        ),
        data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Consulta de 2022 indisponível.");
      const selected = historicalCandidateSchema.parse(data.selected);
      if (
        data.uf !== uf ||
        data.year !== 2022 ||
        data.round !== 1 ||
        selected.id !== id
      )
        throw new Error("Candidatura histórica incorreta.");
      if (historyController.current === abort && !abort.signal.aborted) {
        setHistory(selected);
        setHistoryMessage(
          "Candidatura de 2022 escolhida por você. Confira se é a mesma pessoa de 2026.",
        );
      }
    } catch (error) {
      if (historyController.current === abort && !abort.signal.aborted) {
        setHistoryId("");
        setHistoryMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível consultar 2022.",
        );
      }
    } finally {
      if (historyController.current === abort && !abort.signal.aborted)
        setHistoryLoading(false);
    }
  }
  async function download(data: MunicipalExport, signal?: AbortSignal) {
    setDownloading(true);
    try {
      const response = await fetch("/api/elections/municipal/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(municipalExportSchema.parse(data)),
        signal,
      });
      if (!response.ok)
        throw new Error(
          "Não foi possível gerar o arquivo. Tente baixar novamente.",
        );
      downloadBlob(await response.blob(), municipalDownloadName(data, "xlsx"));
      if (!signal?.aborted)
        setMessage(
          `Excel gerado: ${data.rows.length} cidades, ${data.rows.filter((r) => r.votes !== null).length} com votos disponíveis.${data.historyCandidateId ? " A mesma planilha inclui votos de 2026, votos de 2022, diferença de votos e variação percentual." : " Arquivo com votos de 2026."}`,
        );
    } finally {
      setDownloading(false);
    }
  }
  async function generate() {
    if (!candidate || !cities.length || controller.current || historyLoading)
      return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setDone(0);
    setMessage("Consultando os votos por cidade…");
    let data: MunicipalExport = {
      uf,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        number: candidate.number,
        party: candidate.party,
        office,
      },
      rows: initialExportRows(cities),
      ...(compare && history ? { historyCandidateId: history.id } : {}),
    };
    setResult(data);
    try {
      for (let i = 0; i < cities.length; i += 20) {
        const codes = cities.slice(i, i + 20).map((c) => c.code),
          params = new URLSearchParams({
            uf,
            office,
            candidate: candidate.id,
            cities: codes.join(","),
          });
        const timer = window.setTimeout(() => abort.abort(), 60_000);
        let batch: {
          uf: string;
          candidate: MunicipalExport["candidate"];
          rows: MunicipalExportRow[];
          stale: boolean;
        };
        try {
          const response = await fetch(
            `/api/elections/municipal/candidate?${params}`,
            { cache: "no-store", signal: abort.signal },
          );
          if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(
              error?.error || "Não foi possível consultar os votos.",
            );
          }
          batch = await response.json();
        } finally {
          clearTimeout(timer);
        }
        if (controller.current !== abort || abort.signal.aborted) return;
        if (
          batch.uf !== uf ||
          batch.candidate.id !== candidate.id ||
          batch.candidate.office !== office
        )
          throw new Error("Resposta de outro candidato ou estado rejeitada.");
        data = municipalExportSchema.parse({
          ...data,
          candidate: batch.candidate,
          rows: mergeExportRows(data.rows, batch.rows, codes),
        });
        setResult(data);
        setDone(i + codes.length);
        if (batch.stale) {
          setMessage(
            "Parte da consulta não atualizou. Você pode baixar um Excel parcial; cidades sem dados ficam em branco.",
          );
          return;
        }
      }
      await download(data, abort.signal);
    } catch (error) {
      if (controller.current === abort)
        setMessage(
          abort.signal.aborted
            ? "Consulta interrompida. As cidades já recebidas podem ser baixadas no Excel parcial."
            : `${error instanceof Error ? error.message : "Consulta indisponível."} Você pode baixar os dados já recebidos.`,
        );
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const partial =
    result &&
    (done < result.rows.length || result.rows.some((row) => row.stale));
  return (
    <section
      className="analysis-panel panel municipal-excel"
      id="excel-municipal"
      aria-labelledby="municipal-excel-title"
    >
      <header className="analysis-heading">
        <div>
          <span className="section-tag">
            <FileSpreadsheet size={15} />
            VOTOS POR CIDADE · {uf.toUpperCase()}
          </span>
          <h2 id="municipal-excel-title">
            Excel de um candidato por município
          </h2>
          <p className="small muted">
            Votos nas {cities.length || "—"} cidades do estado. Inclua a
            comparação com 2022 para ver onde a votação aumentou ou diminuiu.
          </p>
        </div>
      </header>
      <div className="municipal-excel-fields">
        <label>
          Cargo em 2026
          <select
            aria-label="Cargo para exportar Excel"
            value={office}
            disabled={busy || downloading}
            onChange={(e) => {
              reset();
              setOffice(e.target.value as Office);
              setQuery("");
            }}
          >
            {OFFICES.map((o) => (
              <option key={o} value={o}>
                {officeLabel(o, uf)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar candidato
          <span className="search">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="Buscar candidato para Excel"
              placeholder="Nome, número ou partido"
              value={query}
              disabled={busy || downloading}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </label>
        <label>
          Candidato em 2026
          <select
            aria-label="Candidato para exportar Excel"
            value={candidateId}
            disabled={busy || downloading || !all.length}
            onChange={(e) => {
              reset();
              setCandidateId(e.target.value);
            }}
          >
            <option value="">Selecione um candidato</option>
            {candidate && !candidates.some((c) => c.id === candidate.id) && (
              <option value={candidate.id}>
                {candidate.name} · {candidate.number} · {candidate.party}
              </option>
            )}
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.number} · {c.party}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="historical-comparison">
        <label className="pending-toggle">
          <input
            type="checkbox"
            checked={compare}
            disabled={busy || downloading}
            onChange={(e) => {
              clearResult();
              setCompare(e.target.checked);
            }}
          />
          Comparar com 2022 na mesma planilha
        </label>
        {compare && candidate && (
          <>
            <p className="small muted" role="status">
              {historyLoading
                ? "Procurando a candidatura de 2022…"
                : historyMessage}
            </p>
            {choices.length > 0 && (
              <div className="historical-fields">
                <label>
                  Buscar em 2022
                  <span className="search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      aria-label="Buscar candidato em 2022"
                      placeholder="Nome, número ou partido de 2022"
                      value={historyQuery}
                      disabled={busy || downloading || historyLoading}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />
                  </span>
                </label>
                <label>
                  Candidatura da mesma pessoa em 2022
                  <select
                    aria-label="Candidato em 2022 para comparar"
                    value={historyId}
                    disabled={busy || downloading || historyLoading}
                    onChange={(e) => void chooseHistory(e.target.value)}
                  >
                    <option value="">Sem comparação · somente 2026</option>
                    {history &&
                      !filteredHistory.some(
                        (candidate) => candidate.id === history.id,
                      ) && (
                        <option value={history.id}>
                          {history.name} · {history.number} · {history.party} ·{" "}
                          {officeLabel(history.office, uf)}
                        </option>
                      )}
                    {filteredHistory.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} · {candidate.number} ·{" "}
                        {candidate.party} · {officeLabel(candidate.office, uf)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {history && (
              <p className="historical-selected small">
                2022: <strong>{history.name}</strong> ·{" "}
                {officeLabel(history.office, uf)} · {history.number} ·{" "}
                {history.party}
                <br />
                2026: <strong>{candidate.name}</strong> ·{" "}
                {officeLabel(office, uf)} · {candidate.number} ·{" "}
                {candidate.party}
              </p>
            )}
          </>
        )}
        <p className="small muted">
          Primeiro turno nos dois anos. Os votos de 2026 podem estar parciais.
          Diferença = votos de 2026 − votos de 2022. Variação percentual =
          diferença ÷ votos de 2022; base zero fica sem percentual.
        </p>
      </div>
      <div className="tool-actions">
        <button
          className="add-button"
          disabled={
            !candidate ||
            !cities.length ||
            busy ||
            downloading ||
            historyLoading
          }
          onClick={() => void generate()}
        >
          <FileSpreadsheet size={16} aria-hidden="true" />
          {busy ? "Consultando cidades…" : "Gerar Excel com votos por cidade"}
        </button>
        {busy && (
          <button
            className="secondary-button"
            onClick={() => controller.current?.abort()}
          >
            Interromper consulta
          </button>
        )}
        {result && !busy && available > 0 && (
          <button
            className="secondary-button"
            disabled={downloading}
            onClick={() =>
              void download(result).catch((e) =>
                setMessage(e instanceof Error ? e.message : "Falha ao baixar."),
              )
            }
          >
            <Download size={16} aria-hidden="true" />
            {downloading
              ? "Gerando arquivo…"
              : partial
                ? "Baixar Excel parcial"
                : "Baixar Excel novamente"}
          </button>
        )}
      </div>
      {(busy || result) && (
        <div className="municipal-excel-progress">
          <progress
            value={done}
            max={cities.length || 1}
            aria-label="Cidades consultadas para Excel"
          />
          <p className="small muted">
            {done} de {cities.length} cidades consultadas · {available} com
            votos disponíveis.
          </p>
        </div>
      )}
      <p className="small muted" role="status">
        {message ||
          "O Excel traz cidades e votos, sem colunas técnicas de apuração. Células vazias indicam dados indisponíveis. A consulta pode levar alguns minutos."}
      </p>
      {result && (
        <div
          className="municipal-excel-preview"
          tabIndex={0}
          role="region"
          aria-label="Prévia da planilha"
        >
          <table>
            <caption>
              Prévia do Excel · primeiras 8 cidades em ordem alfabética
            </caption>
            <thead>
              <tr>
                <th>Município</th>
                <th>Votos do candidato em 2026</th>
                {result.historyCandidateId && (
                  <th>Votos do candidato em 2022</th>
                )}
                {result.historyCandidateId && (
                  <>
                    <th>Diferença de votos</th>
                    <th>Variação (%)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 8).map((row) => {
                const old =
                    result.historyCandidateId && history
                      ? (history.votes[row.code] ?? null)
                      : null,
                  change = voteChange(old, row.votes);
                return (
                  <tr key={row.code}>
                    <td>{row.name}</td>
                    <td>{number(row.votes)}</td>
                    {result.historyCandidateId && <td>{number(old)}</td>}
                    {result.historyCandidateId && (
                      <>
                        <td
                          className={
                            change.difference !== null && change.difference < 0
                              ? "negative"
                              : "positive"
                          }
                        >
                          {change.difference === null
                            ? "—"
                            : `${change.difference > 0 ? "+" : ""}${number(change.difference)}`}
                        </td>
                        <td>
                          {change.relative === null
                            ? "—"
                            : `${change.relative > 0 ? "+" : ""}${percentage(change.relative * 100)}`}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
