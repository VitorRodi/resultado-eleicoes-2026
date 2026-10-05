"use client";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Printer,
  Search,
  FileText,
  Check,
  ArrowDown,
} from "lucide-react";
import {
  OFFICES,
  type Office,
  type ElectionSnapshot,
  type Candidate,
  type WatchPreferences,
} from "@/types/election";
import { officeLabel } from "@/lib/config";
import { matchesCandidate } from "@/lib/panel-tools";
import {
  initialExportRows,
  municipalExportSchema,
} from "@/lib/municipal-export";
import { reportDistribution, type RegionCatalog } from "@/lib/candidate-report";
import { preparedReportHtml, type PreparedReport } from "@/lib/report-document";
import {
  REPORT_TYPES,
  PERSONAL_LABELS,
  defaultReportPersonalization,
  reportPersonalizationSchema,
  reportMunicipalities,
  type ReportType,
} from "@/lib/report-options";
import {
  queryReportCities,
  reportHistoryChoices,
  reportHistoricalCandidate,
  type ReportHistoryChoices,
} from "@/lib/report-query";
import { municipalDownloadName } from "@/lib/export-filenames";
import { downloadBlob } from "@/lib/download";
import { useDisplaySettings } from "@/components/layout/display-settings";

const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
type HistoryState = {
  key: string;
  data?: ReportHistoryChoices;
  error?: string;
};

export default function CandidateReportPanel({
  uf,
  snapshot,
  initialCandidate,
  preferences,
}: {
  uf: string;
  snapshot: ElectionSnapshot | null;
  initialCandidate?: Candidate | null;
  preferences?: WatchPreferences;
}) {
  const display = useDisplaySettings();
  const [office, setOffice] = useState<Office>(
    initialCandidate?.office || "federalDeputy",
  );
  const [candidateId, setCandidateId] = useState(initialCandidate?.id || "");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ReportType>("state");
  const [codes, setCodes] = useState<string[]>(
    () =>
      preferences?.regional.find(
        (s) =>
          s.candidateId === initialCandidate?.id &&
          s.office === initialCandidate?.office,
      )?.municipalityCodes || [],
  );
  const [cityQuery, setCityQuery] = useState("");
  const [personalization, setPersonalization] = useState(
    defaultReportPersonalization,
  );
  const [historyState, setHistoryState] = useState<HistoryState | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyConfirmed, setHistoryConfirmed] = useState(false);
  const [historyRetry, setHistoryRetry] = useState(0);
  const [report, setReport] = useState<PreparedReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const preview = useRef<HTMLIFrameElement | null>(null);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const all = snapshot?.[office] || [];
  const candidate = all.find((c) => c.id === candidateId);
  const choices = all
    .filter((c) => matchesCandidate(c, query))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const municipalities = [...(snapshot?.municipalities || [])].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const selected = municipalities.filter((city) => codes.includes(city.code));
  const visibleCities = municipalities.filter((city) =>
    searchable(city.name).includes(searchable(cityQuery)),
  );
  const savedCodes =
    preferences?.regional
      .find((s) => s.candidateId === candidateId && s.office === office)
      ?.municipalityCodes.filter((code) =>
        municipalities.some((city) => city.code === code),
      ) || [];
  const historyKey = `${uf}:${office}:${candidateId}:${historyRetry}`;
  const history = historyState?.key === historyKey ? historyState : null;
  const selectedHistoryId = historyId ?? history?.data?.matchedId ?? "";
  const autoMatch =
    !!selectedHistoryId && selectedHistoryId === history?.data?.matchedId;
  const historyChoice = history?.data?.candidates.find(
    (c) => c.id === selectedHistoryId,
  );
  const historicalChoices = (history?.data?.candidates || []).filter((c) =>
    searchable(`${c.name} ${c.fullName} ${c.number} ${c.party}`).includes(
      searchable(historyQuery),
    ),
  );
  const cityCount = type === "state" ? municipalities.length : selected.length;
  const ready =
    !!candidate &&
    cityCount > 0 &&
    (type !== "comparison" ||
      (!!historyChoice && (autoMatch || historyConfirmed)));
  const locked = busy || !!exporting;
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  useEffect(() => {
    if (type !== "comparison" || !candidate) return;
    const abort = new AbortController();
    const key = historyKey;
    void reportHistoryChoices(uf, candidate, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) setHistoryState({ key, data });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setHistoryState({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível consultar 2022.",
          });
      });
    return () => abort.abort();
    // A refresh of live votes must not restart the historical identity lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, uf, office, candidateId, historyRetry]);

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setReport(null);
    setMessage("");
    setDone(0);
    setBusy(false);
  }
  function resetIdentity() {
    reset();
    setHistoryId(null);
    setHistoryQuery("");
    setHistoryConfirmed(false);
    setHistoryState(null);
  }
  async function generate() {
    if (!ready || !candidate || !snapshot || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setReport(null);
    setDone(0);
    setMessage("Preparando a consulta das cidades escolhidas…");
    const pinned = structuredClone(snapshot),
      picked = structuredClone(candidate);
    const cities = reportMunicipalities(
      pinned.municipalities,
      selected.map((city) => city.code),
      type,
    );
    let data: PreparedReport = {
      type,
      personalization: reportPersonalizationSchema.parse(personalization),
      uf,
      stateName: pinned.state.name,
      candidate: picked,
      meta: pinned.offices[office],
      stateStale: pinned.offices[office].stale || false,
      generatedAt: new Date().toISOString(),
      municipalities: cities,
      rows: initialExportRows(cities),
      regions: {},
    };
    try {
      if (type === "comparison") {
        data.historical =
          autoMatch && history?.data?.selected
            ? structuredClone(history.data.selected)
            : await reportHistoricalCandidate(
                uf,
                picked,
                selectedHistoryId,
                abort.signal,
              );
      }
      if (type === "state") {
        try {
          const response = await fetch(
            `/api/elections/municipal/regions?uf=${uf}`,
            {
              signal: AbortSignal.any([
                abort.signal,
                AbortSignal.timeout(30_000),
              ]),
            },
          );
          const catalog = await response.json();
          if (!response.ok || catalog.uf !== uf)
            throw new Error("Regiões indisponíveis");
          data.regions = catalog.municipalities as RegionCatalog;
        } catch (error) {
          if (abort.signal.aborted) throw error;
          setMessage(
            "Regiões indisponíveis. Continuando com os votos por cidade.",
          );
        }
      }
      await queryReportCities({
        uf,
        candidate: picked,
        municipalities: cities,
        signal: abort.signal,
        onProgress(rows, count) {
          data = { ...data, rows };
          if (controller.current === abort) setDone(count);
        },
      });
      if (controller.current === abort && !abort.signal.aborted) {
        setReport(data);
        setMessage(
          "Relatório preparado. Confira a prévia e baixe o PDF abaixo.",
        );
      }
    } catch (error) {
      if (controller.current === abort) {
        if (
          data.rows.some((row) => row.votes !== null) &&
          (type !== "comparison" || data.historical)
        )
          setReport(data);
        setMessage(
          `${abort.signal.aborted ? "Consulta interrompida." : error instanceof Error ? error.message : "Consulta indisponível."} ${data.rows.some((row) => row.votes !== null) ? "Dados recebidos disponíveis na prévia; cidades sem dados ficam identificadas." : "Nenhum voto recebido. Tente novamente."}`,
        );
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  async function exportReport(format: "pdf" | "xlsx") {
    if (!report || locked) return;
    setExporting(format);
    setMessage(
      format === "pdf"
        ? "Preparando o PDF para download…"
        : "Preparando a planilha…",
    );
    try {
      const filename = municipalDownloadName(
        {
          uf: report.uf,
          candidate: report.candidate,
          historyCandidateId: report.historical?.id,
        },
        format,
      );
      if (format === "pdf") {
        const { municipalPdf, loadMunicipalPdfFonts } = await import(
          "@/lib/municipal-pdf"
        );
        const bytes = municipalPdf(
          {
            uf: report.uf,
            candidate: report.candidate,
            generatedAt: report.generatedAt,
            historical: report.historical,
            personalization: report.personalization,
            profile: report.type === "state" ? report : undefined,
            rows: report.rows.map((row) => ({
              ...row,
              status: ["counting", "finished"].includes(row.status)
                ? (row.status as "counting" | "finished")
                : "unavailable",
            })),
          },
          await loadMunicipalPdfFonts(),
        );
        downloadBlob(
          new Blob([bytes as BlobPart], { type: "application/pdf" }),
          report.type === "state"
            ? filename.replace(
                "votos-por-municipio-de-",
                "perfil-no-estado-de-",
              )
            : filename,
        );
      } else {
        const body = municipalExportSchema.parse({
          uf: report.uf,
          candidate: report.candidate,
          rows: report.rows,
          historyCandidateId: report.historical?.id,
        });
        const response = await fetch("/api/elections/municipal/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Não foi possível baixar a planilha.");
        }
        downloadBlob(await response.blob(), filename);
      }
      setMessage(
        `${format === "pdf" ? "PDF" : "Planilha"} baixado com os dados e as cidades desta prévia.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Download indisponível. Tente novamente.",
      );
    } finally {
      setExporting(null);
    }
  }
  const distribution = report ? reportDistribution(report) : null;
  const html = report ? preparedReportHtml(report, false, display) : "";
  return (
    <section
      className="candidate-report-panel analysis-panel panel"
      aria-labelledby="candidate-report-title"
    >
      <header className="analysis-heading">
        <div>
          <span className="section-tag">
            Documentos para consultar e compartilhar
          </span>
          <h2 id="candidate-report-title">Central de relatórios</h2>
          <p className="muted">
            Escolha a candidatura, defina o recorte e personalize o documento.
            Você confere tudo antes de baixar.
          </p>
        </div>
      </header>
      <div className="report-builder">
        <div className="report-builder-form">
          <fieldset className="report-step" disabled={locked}>
            <legend>
              <span aria-hidden="true">1</span> Quem você quer acompanhar?
            </legend>
            <div className="report-picker">
              <label>
                Cargo
                <select
                  aria-label="Cargo do relatório"
                  value={office}
                  onChange={(e) => {
                    resetIdentity();
                    setOffice(e.target.value as Office);
                    setCandidateId("");
                    setQuery("");
                    setCodes([]);
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
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Buscar candidato do relatório"
                    value={query}
                    placeholder="Nome, número ou partido"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </span>
              </label>
              <label>
                Candidato
                <select
                  aria-label="Candidato do relatório"
                  value={candidateId}
                  onChange={(e) => {
                    resetIdentity();
                    setCandidateId(e.target.value);
                    setCodes(
                      preferences?.regional.find(
                        (s) =>
                          s.candidateId === e.target.value &&
                          s.office === office,
                      )?.municipalityCodes || [],
                    );
                  }}
                >
                  <option value="">Selecione um candidato</option>
                  {candidate && !choices.some((c) => c.id === candidate.id) && (
                    <option value={candidate.id}>
                      {candidate.name} · {candidate.number}
                    </option>
                  )}
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.number} · {c.party}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!choices.length && (
              <p className="small muted">
                Nenhum candidato encontrado para esta busca.
              </p>
            )}
          </fieldset>
          <fieldset className="report-step" disabled={locked}>
            <legend>
              <span aria-hidden="true">2</span> Qual relatório você precisa?
            </legend>
            <div className="report-type-options">
              {REPORT_TYPES.map((option) => (
                <label
                  key={option.id}
                  className={`report-type-option ${type === option.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`report-type-${uf}`}
                    value={option.id}
                    checked={type === option.id}
                    onChange={() => {
                      reset();
                      setType(option.id);
                    }}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
            {type === "comparison" && (
              <div className="report-history">
                <h3>Candidatura de 2022</h3>
                {!candidate ? (
                  <p className="small muted">
                    Selecione um candidato para buscar sua participação em 2022.
                  </p>
                ) : !history ? (
                  <p className="small muted" role="status">
                    Buscando a candidatura de 2022…
                  </p>
                ) : history.error ? (
                  <>
                    <p role="status">{history.error}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        reset();
                        setHistoryRetry((n) => n + 1);
                      }}
                    >
                      Tentar consultar 2022 novamente
                    </button>
                  </>
                ) : (
                  <>
                    <p className="small muted">
                      {autoMatch
                        ? "Encontramos uma candidatura com o mesmo nome completo. Confira a identificação."
                        : "Escolha a candidatura de 2022 da mesma pessoa. O cargo e o partido podem ter mudado."}
                    </p>
                    <div className="report-picker report-two-fields">
                      <label>
                        Buscar em 2022
                        <input
                          value={historyQuery}
                          placeholder="Nome, número ou partido"
                          onChange={(e) => setHistoryQuery(e.target.value)}
                        />
                      </label>
                      <label>
                        Candidato em 2022
                        <select
                          aria-label="Candidato em 2022 do relatório"
                          value={selectedHistoryId}
                          onChange={(e) => {
                            reset();
                            setHistoryId(e.target.value);
                            setHistoryConfirmed(false);
                          }}
                        >
                          <option value="">
                            Selecione a candidatura de 2022
                          </option>
                          {historyChoice &&
                            !historicalChoices.some(
                              (c) => c.id === historyChoice.id,
                            ) && (
                              <option value={historyChoice.id}>
                                {historyChoice.name} · {historyChoice.number}
                              </option>
                            )}
                          {historicalChoices.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.number} · {c.party} ·{" "}
                              {officeLabel(c.office, uf)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {historyChoice && (
                      <p className="small">
                        {historyChoice.fullName} · {historyChoice.number} ·{" "}
                        {historyChoice.party} ·{" "}
                        {officeLabel(historyChoice.office, uf)}
                      </p>
                    )}
                    {historyChoice && !autoMatch && (
                      <label className="report-checkbox">
                        <input
                          type="checkbox"
                          checked={historyConfirmed}
                          onChange={(e) => {
                            reset();
                            setHistoryConfirmed(e.target.checked);
                          }}
                        />
                        <span>
                          Confirmo que é a mesma pessoa nas eleições de 2022 e
                          2026.
                        </span>
                      </label>
                    )}
                    <p className="small muted">
                      Quem não participou de 2022 pode usar o relatório de votos
                      de 2026. Ausência de dados não vira zero.
                    </p>
                  </>
                )}
              </div>
            )}
          </fieldset>
          <fieldset className="report-step" disabled={locked}>
            <legend>
              <span aria-hidden="true">3</span> Quais cidades entram no
              documento?
            </legend>
            {type === "state" ? (
              <div className="report-state-scope">
                <Check size={18} aria-hidden="true" />
                <p>
                  <strong>
                    Todos os {municipalities.length} municípios de{" "}
                    {snapshot?.state.name || uf.toUpperCase()}
                  </strong>
                  <span className="small muted">
                    O perfil completo inclui a distribuição por cidades e
                    regiões do estado.
                  </span>
                </p>
              </div>
            ) : (
              <>
                <label className="report-field">
                  Buscar município
                  <input
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder="Digite o nome da cidade"
                  />
                </label>
                <div className="report-city-tools">
                  <span className="small" role="status">
                    {selected.length} de {municipalities.length} cidades
                    selecionadas
                  </span>
                  <div>
                    <button
                      type="button"
                      className="report-text-button"
                      onClick={() => {
                        reset();
                        setCodes(municipalities.map((city) => city.code));
                      }}
                    >
                      Selecionar todas da UF
                    </button>
                    <button
                      type="button"
                      className="report-text-button"
                      disabled={!selected.length}
                      onClick={() => {
                        reset();
                        setCodes([]);
                      }}
                    >
                      Limpar seleção
                    </button>
                    <button
                      type="button"
                      className="report-text-button"
                      disabled={!savedCodes.length}
                      onClick={() => {
                        reset();
                        setCodes(savedCodes);
                      }}
                    >
                      Usar cidades do meu painel
                      {savedCodes.length ? ` (${savedCodes.length})` : ""}
                    </button>
                  </div>
                </div>
                <div className="report-city-list">
                  {visibleCities.map((city) => (
                    <label key={city.code} className="report-city-option">
                      <input
                        type="checkbox"
                        checked={codes.includes(city.code)}
                        onChange={(e) => {
                          reset();
                          setCodes(
                            e.target.checked
                              ? [...codes, city.code]
                              : codes.filter((code) => code !== city.code),
                          );
                        }}
                      />
                      <span>{city.name}</span>
                    </label>
                  ))}
                  {!visibleCities.length && (
                    <p className="small muted">
                      Nenhuma cidade encontrada. Revise o nome na busca.
                    </p>
                  )}
                </div>
                {!!cityQuery && (
                  <p className="small muted">
                    A busca filtra esta lista. As outras cidades marcadas
                    continuam selecionadas.
                  </p>
                )}
                <p className="small muted">
                  Você pode escolher todas as cidades desta UF. O PDF e a
                  planilha usam exatamente essa seleção.
                </p>
              </>
            )}
          </fieldset>
          <fieldset className="report-step" disabled={locked}>
            <legend>
              <span aria-hidden="true">4</span> Como o relatório será
              apresentado?
            </legend>
            <p className="small muted">
              Campos opcionais. Seu nome aparece na identificação do documento.
            </p>
            <div className="report-picker report-two-fields">
              <label>
                Seu nome ou nome da equipe
                <input
                  maxLength={120}
                  value={personalization.name}
                  placeholder="Ex.: Jania Salete Rohde Rodi"
                  onChange={(e) => {
                    reset();
                    setPersonalization({
                      ...personalization,
                      name: e.target.value,
                    });
                  }}
                />
              </label>
              <label>
                Apresentar o nome como
                <select
                  aria-label="Apresentar o nome como"
                  value={personalization.label}
                  onChange={(e) => {
                    reset();
                    setPersonalization({
                      ...personalization,
                      label: e.target.value as typeof personalization.label,
                    });
                  }}
                >
                  {PERSONAL_LABELS.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="report-field">
              Título ou região (opcional)
              <input
                maxLength={120}
                value={personalization.title}
                placeholder="Ex.: Acompanhamento da região oeste"
                onChange={(e) => {
                  reset();
                  setPersonalization({
                    ...personalization,
                    title: e.target.value,
                  });
                }}
              />
            </label>
            <label className="report-checkbox">
              <input
                type="checkbox"
                checked={personalization.includeCharts}
                onChange={(e) => {
                  reset();
                  setPersonalization({
                    ...personalization,
                    includeCharts: e.target.checked,
                  });
                }}
              />
              <span>Incluir gráficos de votação no PDF</span>
            </label>
            <p className="small muted">
              A assinatura do projeto e o LinkedIn de Vitor Rodi ficam no final
              do documento.
            </p>
          </fieldset>
        </div>
        <aside
          className="report-summary"
          aria-labelledby="report-summary-title"
        >
          <span className="section-tag">Antes de gerar</span>
          <h3 id="report-summary-title">Seu relatório</h3>
          <dl>
            <div>
              <dt>Candidatura</dt>
              <dd>
                {candidate ? candidate.name : "Escolha no passo 1"}
                {candidate && (
                  <small>
                    {officeLabel(office, uf)} · {candidate.number} ·{" "}
                    {candidate.party}
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>
                {REPORT_TYPES.find((option) => option.id === type)?.title}
              </dd>
            </div>
            <div>
              <dt>Recorte</dt>
              <dd>
                {snapshot?.state.name || uf.toUpperCase()} · {cityCount}{" "}
                municípios
                {type !== "state" && selected.length > 0 && (
                  <details>
                    <summary>Conferir cidades selecionadas</summary>
                    <ul>
                      {selected.map((city) => (
                        <li key={city.code}>{city.name}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </dd>
            </div>
            {type === "comparison" && (
              <div>
                <dt>Comparação</dt>
                <dd>
                  1º turno · 2022 e 2026
                  {historyChoice && (
                    <small>
                      2022: {historyChoice.name} · {historyChoice.number} ·{" "}
                      {historyChoice.party}
                    </small>
                  )}
                </dd>
              </div>
            )}
            {personalization.name.trim() && (
              <div>
                <dt>{personalization.label}</dt>
                <dd>{personalization.name.trim()}</dd>
              </div>
            )}
            {personalization.title.trim() && (
              <div>
                <dt>Título</dt>
                <dd>{personalization.title.trim()}</dd>
              </div>
            )}
            <div>
              <dt>Apresentação</dt>
              <dd>
                {personalization.includeCharts
                  ? "Tabelas e gráficos"
                  : "Somente tabelas"}
              </dd>
            </div>
          </dl>
          <button
            className="add-button"
            disabled={!ready || locked}
            onClick={() => void generate()}
          >
            <FileText size={16} aria-hidden="true" />
            {busy ? "Preparando relatório…" : "Gerar prévia do relatório"}
          </button>
          {!ready && (
            <p className="small muted">
              {!candidate
                ? "Escolha o cargo e o candidato para continuar."
                : !cityCount
                  ? "Marque pelo menos uma cidade no passo 3."
                  : "Confira a candidatura de 2022 no passo 2 para continuar."}
            </p>
          )}
          {busy && (
            <>
              <div className="municipal-excel-progress">
                <progress
                  value={done}
                  max={cityCount || 1}
                  aria-label="Cidades consultadas para relatório"
                />
                <p className="small muted">
                  {done} de {cityCount} municípios consultados.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => controller.current?.abort()}
              >
                Interromper consulta
              </button>
            </>
          )}
          {report && !busy && (
            <button
              className="report-text-button"
              onClick={() => {
                resultHeading.current?.scrollIntoView({
                  behavior: "auto",
                  block: "start",
                });
                resultHeading.current?.focus();
              }}
            >
              <ArrowDown size={15} aria-hidden="true" />
              Ver prévia e downloads
            </button>
          )}
          <p className="small muted">
            Consultar todo o estado pode levar alguns minutos. O documento
            registra uma consulta e não atualiza após o download.
          </p>
        </aside>
      </div>
      <p className="report-status small" role="status">
        {message ||
          "Preencha as etapas e gere a prévia para conferir os dados antes de compartilhar."}
      </p>
      {report && !busy && (
        <>
          <div className="report-preview-heading">
            <h3 ref={resultHeading} tabIndex={-1}>
              Prévia do documento
            </h3>
            <span className="small muted">
              {distribution?.known} de {report.municipalities.length} cidades
              com votos ·{" "}
              {distribution?.complete
                ? "consulta concluída"
                : "cobertura parcial"}
            </span>
          </div>
          <div className="tool-actions report-downloads">
            <button
              className="add-button"
              disabled={locked || !distribution?.known}
              onClick={() => void exportReport("pdf")}
            >
              <Download size={16} aria-hidden="true" />
              {exporting === "pdf" ? "Preparando PDF…" : "Baixar PDF"}
            </button>
            <button
              className="secondary-button"
              disabled={locked}
              onClick={() => void exportReport("xlsx")}
            >
              <Download size={16} aria-hidden="true" />
              {exporting === "xlsx" ? "Preparando Excel…" : "Baixar Excel"}
            </button>
            <button
              className="secondary-button"
              disabled={locked}
              onClick={() => preview.current?.contentWindow?.print()}
            >
              <Printer size={16} aria-hidden="true" />
              Imprimir / salvar PDF
            </button>
          </div>
          <button
            className="report-text-button"
            disabled={locked}
            onClick={() =>
              downloadBlob(
                new Blob([preparedReportHtml(report, true, display)], {
                  type: "text/html;charset=utf-8",
                }),
                `relatorio-${report.uf}-${report.candidate.number}-${report.type === "comparison" ? "2022-2026" : "2026"}.html`,
              )
            }
          >
            Baixar versão HTML do relatório
          </button>
          <iframe
            ref={preview}
            title={`Relatório de ${report.candidate.name}`}
            className="candidate-report-preview"
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
          />
          <p className="small muted">
            A prévia e os downloads usam os dados desta consulta. Para ajustar
            cidades ou identificação, altere as escolhas e gere novamente.
          </p>
        </>
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
