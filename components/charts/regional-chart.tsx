"use client";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { Pencil, X, Download } from "lucide-react";
import Avatar from "@/components/cards/avatar";
import { officeLabel } from "@/lib/config";
import { number, percentage } from "@/lib/formatting";
import { sumRegional } from "@/lib/tracking";
import { downloadBlob } from "@/lib/download";
import { municipalDownloadName } from "@/lib/export-filenames";
import type { Candidate, MunicipalVote, Office } from "@/types/election";
export default function RegionalChart({
  uf = "sc",
  rows,
  candidate,
  office,
  onEdit,
  onRemove,
}: {
  rows: MunicipalVote[];
  candidate: Candidate | null;
  uf?: string;
  office: Office;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const data = rows;
  const sorted = [...data].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1));
  const aggregate = sumRegional(data);
  const [exporting, setExporting] = useState(false),
    [exportMessage, setExportMessage] = useState("");
  async function exportPdf() {
    if (!candidate || exporting || !aggregate.available) return;
    const input = {
      uf,
      candidate: structuredClone(candidate),
      rows: structuredClone(rows),
      generatedAt: new Date().toISOString(),
    };
    setExporting(true);
    setExportMessage("Preparando o PDF com as cidades selecionadas…");
    try {
      const { municipalPdf, loadMunicipalPdfFonts } =
        await import("@/lib/municipal-pdf");
      const bytes = municipalPdf(input, await loadMunicipalPdfFonts());
      downloadBlob(
        new Blob([bytes], { type: "application/pdf" }),
        municipalDownloadName(input, "pdf"),
      );
      setExportMessage("PDF baixado com os votos dos municípios selecionados.");
    } catch (error) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF. Tente novamente.",
      );
    } finally {
      setExporting(false);
    }
  }
  const chartData = sorted
    .filter((r) => r.votes != null)
    .map((r) => ({ ...r, municipality: r.name }));
  return (
    <article className="regional-card panel">
      <div className="regional-head">
        <Avatar name={candidate?.name || "?"} url={candidate?.photoUrl} />
        <div>
          <h3>{candidate?.name || "Candidatura indisponível"}</h3>
          <p className="small muted">
            {officeLabel(office, uf)} · votos por município
          </p>
        </div>
        <div className="card-actions">
          <button
            className="icon-button"
            onClick={onEdit}
            aria-label={`Editar cidades de ${candidate?.name || "candidato"}`}
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button"
            onClick={onRemove}
            aria-label={`Remover votação municipal de ${candidate?.name || "candidato"}`}
          >
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="regional-total">
        <strong>{number(aggregate.total)}</strong>
        <span className="muted small">
          votos em {data.length}{" "}
          {data.length === 1 ? "município" : "municípios"}
          {aggregate.available > 0 && aggregate.available < data.length
            ? ` · parcial (${aggregate.available}/${data.length})`
            : ""}
        </span>
      </div>
      {aggregate.largest && (
        <p className="largest small">
          Maior votação: <strong>{aggregate.largest.name}</strong> ·{" "}
          {number(aggregate.largest.votes)} votos
        </p>
      )}
      {chartData.length > 0 && (
        <div
          className="chart"
          role="img"
          aria-label={`Gráfico de votos de ${candidate?.name || "candidato"} por município`}
        >
          <ResponsiveContainer
            width="100%"
            height={Math.max(96, chartData.length * 43)}
            minWidth={0}
          >
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 46, top: 8, bottom: 8 }}
            >
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis
                type="category"
                dataKey="municipality"
                width={158}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-soft)" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <strong>{payload[0].payload.name}</strong>
                      <p>{number(payload[0].payload.votes)} votos</p>
                      <p>
                        {percentage(payload[0].payload.percentage)} totalizado
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey="votes"
                fill="var(--accent)"
                radius={[0, 3, 3, 0]}
                barSize={12}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="votes"
                  position="right"
                  fill="var(--text)"
                  fontSize={12}
                  formatter={(v) => number(Number(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div
        className={`municipal-list ${chartData.length ? "compact-municipal" : ""}`}
      >
        {sorted.map((row) => (
          <div className="municipal-row" key={row.name}>
            <span className="municipal-name">{row.name}</span>
            <span className="municipal-value">
              {row.votes == null ? (
                <span
                  className={
                    row.status === "unavailable" ? "warning-text" : "muted"
                  }
                >
                  {row.status === "unavailable"
                    ? "Fonte indisponível"
                    : "Aguardando totalização"}
                </span>
              ) : (
                <>
                  <strong>{number(row.votes)}</strong>
                  <span className="muted">
                    {" "}
                    votos · {percentage(row.percentage)} totalizado
                  </span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="regional-foot small muted">
        Totalização indicada por município. A soma regional pode incluir
        apurações parciais.
      </p>
      <div className="regional-pdf-actions">
        <button
          className="secondary-button"
          disabled={!candidate || !aggregate.available || exporting}
          onClick={() => void exportPdf()}
        >
          <Download size={16} aria-hidden="true" />
          {exporting ? "Gerando PDF…" : "Baixar PDF dos municípios"}
        </button>
        <p className="small muted" role="status">
          {exportMessage ||
            (!aggregate.available
              ? "O PDF fica disponível quando houver votos divulgados."
              : "Inclui somente as cidades deste acompanhamento, com seu total disponível.")}
        </p>
      </div>
    </article>
  );
}
