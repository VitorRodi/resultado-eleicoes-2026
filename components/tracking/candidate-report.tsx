"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Printer, Search, FileText } from "lucide-react";
import {
  OFFICES,
  type Office,
  type ElectionSnapshot,
  type Candidate,
} from "@/types/election";
import { officeLabel } from "@/lib/config";
import { matchesCandidate } from "@/lib/panel-tools";
import {
  initialExportRows,
  mergeExportRows,
  municipalExportSchema,
} from "@/lib/municipal-export";
import {
  candidateReportHtml,
  reportDistribution,
  type CandidateReport,
  type RegionCatalog,
} from "@/lib/candidate-report";
import { downloadBlob } from "@/lib/download";
import { useDisplaySettings } from "@/components/layout/display-settings";
export default function CandidateReportPanel({
  uf,
  snapshot,
  initialCandidate,
}: {
  uf: string;
  snapshot: ElectionSnapshot | null;
  initialCandidate?: Candidate | null;
}) {
  const display = useDisplaySettings();
  const [office, setOffice] = useState<Office>(
      initialCandidate?.office || "federalDeputy",
    ),
    [candidateId, setCandidateId] = useState(initialCandidate?.id || ""),
    [query, setQuery] = useState("");
  const [report, setReport] = useState<CandidateReport | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(0);
  const controller = useRef<AbortController | null>(null),
    preview = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const all = snapshot?.[office] || [],
    candidate = all.find((c) => c.id === candidateId),
    choices = all
      .filter((c) => matchesCandidate(c, query))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  function reset() {
    controller.current?.abort();
    controller.current = null;
    setReport(null);
    setMessage("");
    setDone(0);
    setBusy(false);
  }
  async function generate() {
    if (!candidate || !snapshot || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setReport(null);
    setDone(0);
    setMessage("Consultando cidades e regiões…");
    const pinned = structuredClone(snapshot),
      picked = structuredClone(candidate);
    let data: CandidateReport = {
      uf,
      stateName: pinned.state.name,
      candidate: picked,
      meta: pinned.offices[office],
      stateStale: pinned.offices[office].stale || false,
      generatedAt: new Date().toISOString(),
      municipalities: pinned.municipalities,
      rows: initialExportRows(pinned.municipalities),
      regions: {},
    };
    try {
      try {
        const response = await fetch(
            `/api/elections/municipal/regions?uf=${uf}`,
            {
              signal: AbortSignal.any([
                abort.signal,
                AbortSignal.timeout(30_000),
              ]),
            },
          ),
          catalog = await response.json();
        if (!response.ok || catalog.uf !== uf)
          throw new Error("Regiões indisponíveis");
        data.regions = catalog.municipalities as RegionCatalog;
      } catch (error) {
        if (abort.signal.aborted) throw error;
        setMessage(
          "Regiões indisponíveis. Continuando com os votos por cidade.",
        );
      }
      for (let i = 0; i < data.municipalities.length; i += 20) {
        const codes = data.municipalities.slice(i, i + 20).map((m) => m.code),
          params = new URLSearchParams({
            uf,
            office,
            candidate: picked.id,
            cities: codes.join(","),
          });
        const response = await fetch(
          `/api/elections/municipal/candidate?${params}`,
          {
            cache: "no-store",
            signal: AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(60_000),
            ]),
          },
        );
        if (!response.ok)
          throw new Error("Parte dos resultados municipais está indisponível.");
        const batch = await response.json();
        if (
          batch.uf !== uf ||
          batch.candidate?.id !== picked.id ||
          batch.candidate.office !== office
        )
          throw new Error("Resultado de outra candidatura rejeitado.");
        const checked = municipalExportSchema.parse({
          uf,
          candidate: batch.candidate,
          rows: mergeExportRows(data.rows, batch.rows, codes),
        });
        data = { ...data, rows: checked.rows };
        setDone(i + codes.length);
        if (batch.stale)
          throw new Error(
            "Algumas cidades mantiveram valores anteriores após falha de atualização.",
          );
      }
      if (controller.current === abort && !abort.signal.aborted) {
        setReport(data);
        setMessage(
          "Relatório gerado. Confira a cobertura municipal e a situação oficial antes de compartilhar.",
        );
      }
    } catch (error) {
      if (controller.current === abort) {
        setReport(data);
        setMessage(
          `${abort.signal.aborted ? "Consulta interrompida." : error instanceof Error ? error.message : "Consulta indisponível."} Relatório parcial disponível com as cidades já recebidas.`,
        );
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  const distribution = report ? reportDistribution(report) : null,
    html = report ? candidateReportHtml(report, false, display) : "";
  return (
    <section
      className="candidate-report-panel analysis-panel panel"
      aria-labelledby="candidate-report-title"
    >
      <header className="analysis-heading">
        <div>
          <span className="section-tag">
            Documento para consulta e compartilhamento
          </span>
          <h2 id="candidate-report-title">Relatório de um candidato</h2>
          <p className="muted">
            Posição, situação oficial e distribuição dos votos no estado, com
            gráficos de cidades e regiões.
          </p>
        </div>
      </header>
      <div className="report-picker">
        <label>
          Cargo
          <select
            aria-label="Cargo do relatório"
            value={office}
            disabled={busy}
            onChange={(e) => {
              reset();
              setOffice(e.target.value as Office);
              setCandidateId("");
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
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Buscar candidato do relatório"
              value={query}
              placeholder="Nome, número ou partido"
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </label>
        <label>
          Candidato
          <select
            aria-label="Candidato do relatório"
            value={candidateId}
            disabled={busy}
            onChange={(e) => {
              reset();
              setCandidateId(e.target.value);
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
      <div className="tool-actions">
        <button
          className="add-button"
          disabled={!candidate || busy || !snapshot?.municipalities.length}
          onClick={() => void generate()}
        >
          <FileText size={16} aria-hidden="true" />
          {busy ? "Preparando relatório…" : "Gerar relatório do candidato"}
        </button>
        {busy && (
          <button
            className="secondary-button"
            onClick={() => controller.current?.abort()}
          >
            Interromper consulta
          </button>
        )}
        {report && !busy && (
          <>
            <button
              className="secondary-button"
              onClick={() => preview.current?.contentWindow?.print()}
            >
              <Printer size={16} aria-hidden="true" />
              Imprimir / salvar PDF
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                downloadBlob(
                  new Blob([candidateReportHtml(report, true, display)], {
                    type: "text/html;charset=utf-8",
                  }),
                  `relatorio-${uf}-${report.candidate.number}-2026.html`,
                )
              }
            >
              <Download size={16} aria-hidden="true" />
              Baixar relatório completo
            </button>
          </>
        )}
      </div>
      {busy && (
        <div className="municipal-excel-progress">
          <progress
            value={done}
            max={snapshot?.municipalities.length || 1}
            aria-label="Cidades consultadas para relatório"
          />
          <p className="small muted">
            {done} de {snapshot?.municipalities.length} municípios consultados.
          </p>
        </div>
      )}
      <p className="small muted" role="status">
        {message ||
          "A consulta de todas as cidades pode levar alguns minutos. O relatório registra os resultados desta consulta."}
      </p>
      {report && (
        <>
          <div className="report-preview-heading">
            <h3>Prévia do documento</h3>
            <span className="small muted">
              {distribution?.known} de {report.municipalities.length} cidades
              com votos ·{" "}
              {distribution?.complete
                ? "consulta concluída"
                : "cobertura parcial"}
            </span>
          </div>
          <iframe
            ref={preview}
            title={`Relatório de ${report.candidate.name}`}
            className="candidate-report-preview"
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
          />
          <p className="small muted">
            O arquivo baixado contém os gráficos e a tabela de todas as cidades,
            além de seu nome, LinkedIn e link do painel.
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
