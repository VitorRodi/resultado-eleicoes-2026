import { jsPDF } from "jspdf";
import type { Candidate, MunicipalVote } from "../types/election";
import { BRAZIL_STATES } from "./brazil-states";
import { officeLabel } from "./config";
import { sumRegional } from "./tracking";
import { number, percentage } from "./formatting";
import { reportDistribution, type CandidateReport } from "./candidate-report";
import {
  reportPersonalizationSchema,
  reportComparisonTotals,
  type ReportPersonalization,
} from "./report-options";
import { groupAssociationRows } from "./sc-associations";
import { initialExportRows } from "./municipal-export";

import {
  historicalCandidateSchema,
  voteChange,
  type HistoricalCandidate,
} from "./historical-election";

export type MunicipalPdfInput = {
  uf: string;
  candidate: Candidate;
  rows: MunicipalVote[];
  generatedAt: string;
  historical?: HistoricalCandidate;
  personalization?: ReportPersonalization;
  profile?: CandidateReport;
  separateAssociations?: boolean;
};
export type PdfFonts = { regular: string; bold: string };
const INK = [27, 44, 50] as const,
  GREEN = [23, 101, 92] as const,
  MUTED = [83, 101, 107] as const;
const clean = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
const timestamp = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
export function municipalPdfSummary(input: MunicipalPdfInput) {
  if (
    !BRAZIL_STATES.some((state) => state.uf.toLowerCase() === input.uf) ||
    !input.rows.length ||
    input.rows.length > 1000
  )
    throw new Error("Selecione de 1 a 1000 municípios nesta UF.");
  if (
    input.rows.some(
      (row) =>
        row.votes !== null &&
        (!Number.isSafeInteger(row.votes) ||
          row.votes < 0 ||
          !["counting", "finished"].includes(row.status)),
    )
  )
    throw new Error("Votação municipal inválida.");
  if (
    new Set(input.rows.map((row) => row.code || row.name)).size !==
    input.rows.length
  )
    throw new Error("Municípios duplicados.");
  const rows = [...input.rows].sort(
    (a, b) =>
      (b.votes ?? -1) - (a.votes ?? -1) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const aggregate = sumRegional(rows);
  const times = rows
    .map((row) => row.updatedAt)
    .filter((value): value is string => !!value)
    .sort();
  return {
    rows,
    ...aggregate,
    partial: aggregate.available < rows.length || rows.some((row) => row.stale),
    stale: rows.some((row) => row.stale),
    firstUpdate: times[0] || null,
    lastUpdate: times.at(-1) || null,
  };
}
export function municipalPdf(input: MunicipalPdfInput, fonts: PdfFonts) {
  let summary = municipalPdfSummary(input);
  const history = input.historical
    ? historicalCandidateSchema.parse(input.historical)
    : undefined;
  const personalization = input.personalization
    ? reportPersonalizationSchema.parse(input.personalization)
    : undefined;
  const profile = input.profile;
  if (
    profile &&
    (profile.uf !== input.uf ||
      profile.candidate.id !== input.candidate.id ||
      profile.candidate.office !== input.candidate.office)
  )
    throw new Error("Perfil de outra candidatura rejeitado.");
  if (!summary.available)
    throw new Error("Aguarde a divulgação dos votos para gerar este PDF.");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.addFileToVFS("NotoSans-Regular.ttf", fonts.regular);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", fonts.bold);
  doc.addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
  doc.setProperties({
    title: `${clean(input.candidate.name)} - ${profile ? "Perfil no estado" : history ? "Comparação 2022 e 2026" : "Votos nos municípios selecionados"}`,
    author: "Vitor Rodi",
    subject: `Eleições 2026 - ${input.uf.toUpperCase()} - primeiro turno`,
    creator: "Resultado Eleições 2026",
  });
  const left = 18,
    right = 192,
    width = 174;
  let y = 0;
  let activeRegion = "";
  let activeRegionName = "";
  const write = (
    text: string,
    x: number,
    at: number,
    size = 10,
    bold = false,
    color: readonly [number, number, number] = INK,
    align: "left" | "right" = "left",
  ) => {
    doc.setFont("NotoSans", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(clean(text), x, at, { align });
  };
  function startPage(continuation = false) {
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(1.4);
    doc.line(left, 16, right, 16);
    write("RESULTADO ELEIÇÕES 2026", left, 24, 8, true, GREEN);
    write(
      `${input.uf.toUpperCase()} - 1º turno`,
      right,
      24,
      8,
      false,
      MUTED,
      "right",
    );
    if (continuation) {
      doc.setFont("NotoSans", "bold");
      doc.setFontSize(14);
      const lines = doc.splitTextToSize(
        clean(input.candidate.name),
        width,
      ) as string[];
      lines.forEach((line, i) => write(line, left, 36 + i * 6, 14, true));
      write(
        "Votação nos municípios selecionados - continuação",
        left,
        38 + lines.length * 6,
        9,
        false,
        MUTED,
      );
      y = 47 + lines.length * 6;
      if (activeRegion) {
        write(activeRegion, left, y, 10, true, GREEN);
        y += 8;
      }
      return;
    }
    write(
      profile
        ? "Perfil da candidatura no estado"
        : history
          ? "Votos por município - comparação 2022 e 2026"
          : "Votação nos municípios selecionados",
      left,
      37,
      10,
      false,
      MUTED,
    );
    y = 49;
    if (personalization?.title) {
      doc.setFont("NotoSans", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(
        clean(personalization.title),
        width,
      ) as string[];
      for (const line of lines) {
        write(line, left, y, 11, false, GREEN);
        y += 5.5;
      }
      y += 5;
    }
    if (activeRegion) {
      doc.setFont("NotoSans", "bold");
      doc.setFontSize(11);
      for (const line of doc.splitTextToSize(`${activeRegion} - ${activeRegionName}`, width) as string[]) {
        write(line, left, y, 11, true, GREEN);
        y += 5.5;
      }
      y += 5;
    }
    const titleY = y;
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(21);
    const title = doc.splitTextToSize(
      clean(input.candidate.name),
      width,
    ) as string[];
    for (const [i, line] of title.entries())
      write(line, left, titleY + i * 8, 21, true);
    y = titleY + title.length * 8;
    doc.setFontSize(9);
    const identity = doc.splitTextToSize(
      `${officeLabel(input.candidate.office, input.uf)} - ${input.candidate.number} - ${input.candidate.party} - ${BRAZIL_STATES.find((state) => state.uf.toLowerCase() === input.uf)!.name}`,
      width,
    ) as string[];
    for (const line of identity) {
      write(line, left, y, 9, false, MUTED);
      y += 4.8;
    }
    if (history) {
      doc.setFontSize(8);
      const previousIdentity = doc.splitTextToSize(
        `2022: ${clean(history.name)} - ${history.number} - ${history.party} - ${officeLabel(history.office, input.uf)}`,
        width,
      ) as string[];
      for (const line of previousIdentity) {
        write(line, left, y, 8, false, MUTED);
        y += 4.8;
      }
    }
    if (personalization?.name) {
      y += 3;
      doc.setFont("NotoSans", "bold");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(
        `${personalization.label}: ${clean(personalization.name)}`,
        width,
      ) as string[];
      for (const line of lines) {
        write(line, left, y, 10, true, GREEN);
        y += 5;
      }
    }
    if (profile) {
      const active =
        ["counting", "finished"].includes(profile.meta.status) &&
        input.candidate.rank !== null;
      doc.setFontSize(9);
      const text = active
        ? `Estado: ${number(input.candidate.votes)} votos · ${percentage(input.candidate.percentage)} · ${input.candidate.rank}º por votos · ${number(profile.meta.seats)} vagas. Situação oficial: ${input.candidate.officialElected ? "Eleito - confirmação oficial" : input.candidate.officialStatus || "ainda não informada"}.`
        : "Resultado estadual: aguardando divulgação da votação e da situação oficial.";
      y += 4;
      for (const line of doc.splitTextToSize(text, width) as string[]) {
        write(line, left, y, 9);
        y += 5;
      }
      if (profile.stateStale) {
        write(
          "Resultado estadual preservado após falha de atualização.",
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 5;
      }
      if (["federalDeputy", "stateDeputy"].includes(input.candidate.office)) {
        write(
          "A posição por votos não garante eleição no sistema proporcional.",
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 5;
      }
      const distribution = reportDistribution(profile);
      const qualifier = distribution.complete
        ? ""
        : " entre os dados disponíveis";
      doc.setFontSize(9);
      const highlights = `Maior votação municipal${qualifier}: ${distribution.bestCities.map((city) => city.name).join(", ") || "ainda indisponível"}. Região com mais votos${qualifier}: ${distribution.bestRegions.map((region) => region.name).join(", ") || "ainda indisponível"}.`;
      // A large tie belongs in the full tables, rather than an unbounded cover heading.
      const excerpt =
        highlights.length > 500
          ? "Consulte as tabelas e os gráficos para conferir cidades e regiões com mais votos e eventuais empates."
          : highlights;
      for (const line of doc.splitTextToSize(excerpt, width) as string[]) {
        write(line, left, y, 9, false, GREEN);
        y += 5;
      }
    }
    y += 9;
    doc.setDrawColor(213, 223, 218);
    doc.setLineWidth(0.3);
    doc.line(left, y - 5, right, y - 5);
    write(
      history ? "Votos de 2026 nas cidades" : "Votos nas cidades escolhidas",
      left,
      y,
      8,
      false,
      MUTED,
    );
    write("Cidades selecionadas", 86, y, 8, false, MUTED);
    write("Cidades com votos", 148, y, 8, false, MUTED);
    write(number(summary.total), left, y + 10, 22, true, GREEN);
    write(String(summary.rows.length), 86, y + 10, 22, true);
    write(
      `${summary.available} de ${summary.rows.length}`,
      148,
      y + 10,
      22,
      true,
    );
    y += 21;
    if (history) {
      const rows = initialExportRows(
        summary.rows.map((row) => ({ code: row.code!, name: row.name })),
      ).map((row, i) => ({ ...row, votes: summary.rows[i].votes }));
      const totals = reportComparisonTotals(rows, history);
      const change =
        totals.difference === null
          ? "—"
          : `${totals.difference > 0 ? "+" : ""}${number(totals.difference)}`;
      const pct =
        totals.relative === null
          ? "sem percentual"
          : `${totals.relative > 0 ? "+" : ""}${percentage(totals.relative * 100)}`;
      doc.setFontSize(9);
      for (const line of doc.splitTextToSize(
        `Comparação em ${totals.paired} de ${summary.rows.length} cidades: ${number(totals.previous)} votos em 2022; ${number(totals.current)} em 2026; diferença ${change}; variação ${pct}.`,
        width,
      ) as string[]) {
        write(line, left, y, 9, true, GREEN);
        y += 5;
      }
      y += 4;
    }
    write(
      summary.partial ||
        (history &&
          summary.rows.some(
            (row) => !row.code || history.votes[row.code] === undefined,
          ))
        ? "Consulta parcial - confira as cidades sem dados ou com valores anteriores."
        : "Votos disponíveis em todas as cidades selecionadas.",
      left,
      y,
      8,
      false,
      MUTED,
    );
    y += 5;
    write(
      "As quantidades registram esta consulta e podem incluir apurações parciais.",
      left,
      y,
      8,
      false,
      MUTED,
    );
    y += 12;
  }
  function chart(title: string, rows: { name: string; votes: number }[]) {
    if (!rows.length) return;
    if (y + 25 > 250) {
      doc.addPage();
      startPage(true);
    }
    write(title, left, y, 12, true);
    y += 10;
    const max = Math.max(1, ...rows.map((row) => row.votes));
    for (const row of rows) {
      doc.setFont("NotoSans", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(clean(row.name), 135) as string[];
      const height = lines.length * 4.5 + 6;
      if (y + height > 260) {
        doc.addPage();
        startPage(true);
        write(`${title} - continuação`, left, y, 12, true);
        y += 10;
      }
      lines.forEach((line, i) => write(line, left, y + i * 4.5, 9));
      write(number(row.votes), right, y, 9, true, GREEN, "right");
      const barY = y + lines.length * 4.5;
      doc.setFillColor(222, 233, 225);
      doc.rect(left, barY, width, 3, "F");
      if (row.votes > 0) {
        doc.setFillColor(...GREEN);
        doc.rect(left, barY, (width * row.votes) / max, 3, "F");
      }
      y += height;
    }
    y += 10;
  }
  function tableHeader() {
    doc.setFillColor(...GREEN);
    doc.rect(left, y - 5, width, 10, "F");
    write("Município", left + 3, y + 1, 9, true, [255, 255, 255]);
    if (history) {
      for (const [label, x] of [
        ["2022", 120],
        ["2026", 144],
        ["Diferença", 166],
        ["Variação (%)", 189],
      ] as const)
        write(label, x, y + 1, 7, true, [255, 255, 255], "right");
    } else {
      if (personalization?.includeCharts !== false)
        write("Comparação visual", 113, y + 1, 8, true, [255, 255, 255]);
      write("Votos", right - 3, y + 1, 9, true, [255, 255, 255], "right");
    }
    y += 9;
  }
  function renderSection() {
    startPage();
    if (personalization?.includeCharts) {
      chart(
        "As 10 cidades com mais votos de 2026 neste conjunto",
        summary.rows
          .filter((row) => row.votes !== null)
          .slice(0, 10)
          .map((row) => ({ name: row.name, votes: row.votes! })),
      );
      if (profile) {
        const distribution = reportDistribution(profile);
        chart(
          "As 10 regiões com mais votos disponíveis",
          distribution.regions.slice(0, 10),
        );
        if (y + 14 > 260) {
          doc.addPage();
          startPage(true);
        }
        write(
          `Regiões imediatas do IBGE; ${distribution.known} de ${profile.municipalities.length} cidades com votos.`,
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 5;
        write(
          `${distribution.unmapped} cidades com votos sem região identificada; somas podem diferir do total estadual.`,
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 10;
      }
    }
    if (y + (profile ? 32 : 22) + 40 > 259) {
      doc.addPage();
      startPage(true);
    }
    y += 5;
    write(
      history
        ? "Diferença = 2026 − 2022. Variação (%) = diferença ÷ votos de 2022 × 100; base zero não tem percentual."
        : personalization?.includeCharts === false
          ? "Votação nas cidades selecionadas nesta consulta."
          : "Barras proporcionais à cidade com maior votação neste conjunto.",
      left,
      y,
      7,
      false,
      MUTED,
    );
    y += 5;
    write(
      "Zero é uma quantidade divulgada; sem dados não significa zero votos.",
      left,
      y,
      7,
      false,
      MUTED,
    );
    y += 5;
    if (summary.stale) {
      write(
        "Há resultados preservados após falha de atualização, indicados na tabela.",
        left,
        y,
        7,
        false,
        MUTED,
      );
      y += 5;
    }
    if (summary.lastUpdate)
      write(
        `Resultados municipais: ${timestamp(summary.firstUpdate!)} até ${timestamp(summary.lastUpdate)} (Brasília).`,
        left,
        y,
        7,
        false,
        MUTED,
      );
    if (profile?.meta.updatedAt) {
      y += 5;
      write(
        `Resultado estadual: ${timestamp(profile.meta.updatedAt)} (Brasília).`,
        left,
        y,
        7,
        false,
        MUTED,
      );
    }
    y += 10;
    if (y + 25 > 259) {
      doc.addPage();
      startPage(true);
    }
    tableHeader();
    const max = Math.max(1, ...summary.rows.map((row) => row.votes ?? 0));
    for (const [i, row] of summary.rows.entries()) {
      doc.setFont("NotoSans", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(
        clean(row.name),
        history ? 72 : 86,
      ) as string[];
      const height = Math.max(11, lines.length * 4.5 + 6) + (row.stale ? 4 : 0);
      if (y + height > 259) {
        doc.addPage();
        startPage(true);
        tableHeader();
      }
      if (i % 2) {
        doc.setFillColor(240, 245, 242);
        doc.rect(left, y - 4, width, height, "F");
      }
      for (const [n, line] of lines.entries())
        write(line, left + 3, y + 2 + n * 4.5, 9);
      if (row.stale)
        write(
          "Último valor disponível",
          left + 3,
          y + 3 + lines.length * 4.5,
          7,
          false,
          MUTED,
        );
      if (history) {
        const previous = row.code ? (history.votes[row.code] ?? null) : null;
        const change = voteChange(previous, row.votes);
        write(
          previous === null ? "Sem dados" : number(previous),
          120,
          y + 2,
          8,
          false,
          INK,
          "right",
        );
        write(
          row.votes === null ? "Sem dados" : number(row.votes),
          144,
          y + 2,
          8,
          true,
          INK,
          "right",
        );
        const delta =
          change.difference === null
            ? "—"
            : `${change.difference > 0 ? "+" : ""}${number(change.difference)}`;
        const pct =
          change.relative === null
            ? previous === 0 && row.votes !== null
              ? "Base zero"
              : "—"
            : `${change.relative > 0 ? "+" : ""}${percentage(change.relative * 100)}`;
        const color =
          change.difference !== null && change.difference < 0
            ? ([177, 60, 70] as const)
            : GREEN;
        write(delta, 166, y + 2, 8, true, color, "right");
        write(pct, 189, y + 2, 7, true, color, "right");
      } else if (row.votes !== null) {
        if (personalization?.includeCharts !== false) {
          doc.setFillColor(222, 233, 225);
          doc.roundedRect(113, y - 1, 50, 3.5, 1, 1, "F");
          if (row.votes > 0) {
            doc.setFillColor(...GREEN);
            doc.roundedRect(113, y - 1, (50 * row.votes) / max, 3.5, 1, 1, "F");
          }
        }
        write(number(row.votes), right - 3, y + 2, 10, true, INK, "right");
      } else write("Sem dados", right - 3, y + 2, 8, false, MUTED, "right");
      y += height;
    }
    if (profile) {
      const distribution = reportDistribution(profile);
      if (distribution.regions.length) {
        doc.addPage();
        startPage(true);
        const regionHeader = () => {
          write("Votos por região imediata", left, y, 13, true);
          y += 11;
          doc.setFillColor(...GREEN);
          doc.rect(left, y - 5, width, 10, "F");
          write("Região", left + 3, y + 1, 9, true, [255, 255, 255]);
          write(
            "Votos disponíveis",
            150,
            y + 1,
            8,
            true,
            [255, 255, 255],
            "right",
          );
          write(
            "Cidades com votos",
            189,
            y + 1,
            8,
            true,
            [255, 255, 255],
            "right",
          );
          y += 9;
        };
        regionHeader();
        for (const [i, region] of distribution.regions.entries()) {
          doc.setFont("NotoSans", "normal");
          doc.setFontSize(9);
          const lines = doc.splitTextToSize(clean(region.name), 88) as string[];
          const height =
            Math.max(12, lines.length * 4.5 + 6) + (region.stale ? 4 : 0);
          if (y + height > 259) {
            doc.addPage();
            startPage(true);
            regionHeader();
          }
          if (i % 2) {
            doc.setFillColor(240, 245, 242);
            doc.rect(left, y - 4, width, height, "F");
          }
          lines.forEach((line, n) => write(line, left + 3, y + 2 + n * 4.5, 9));
          if (region.stale)
            write(
              "Últimos valores disponíveis",
              left + 3,
              y + 3 + lines.length * 4.5,
              7,
              false,
              MUTED,
            );
          write(number(region.votes), 150, y + 2, 9, true, INK, "right");
          write(
            `${region.known} de ${region.total}`,
            189,
            y + 2,
            9,
            false,
            INK,
            "right",
          );
          y += height;
        }
        if (y + 17 > 267) {
          doc.addPage();
          startPage(true);
        }
        y += 5;
        write(
          `Regiões imediatas do IBGE; ${distribution.unmapped} cidades com votos sem região identificada.`,
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 5;
        write(
          "Somente municípios com votos disponíveis entram nas somas regionais.",
          left,
          y,
          8,
          false,
          MUTED,
        );
        y += 7;
      }
    }

  }
  if (input.uf === "sc" && input.separateAssociations && !profile) {
    for (const [index, group] of groupAssociationRows(input.rows).entries()) {
      if (index > 0) doc.addPage();
      activeRegion = group.id;
      activeRegionName = group.name;
      summary = municipalPdfSummary({ ...input, rows: group.rows });
      renderSection();
    }
  } else renderSection();
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(213, 223, 218);
    doc.setLineWidth(0.3);
    doc.line(left, 274, right, 274);
    write("Feito por Vitor Rodi", left, 280, 8, true, GREEN);
    write(`Página ${page} de ${pages}`, right, 280, 8, false, MUTED, "right");
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREEN);
    doc.textWithLink("LinkedIn: linkedin.com/in/vitor-rodi", left, 285, {
      url: "https://br.linkedin.com/in/vitor-rodi",
    });
    write(
      `Gerado em ${timestamp(input.generatedAt)} (Brasília)`,
      right,
      285,
      7,
      false,
      MUTED,
      "right",
    );
    doc.setFontSize(7);
    doc.textWithLink("resultado-eleicoes-2026.vercel.app", left, 290, {
      url: "https://resultado-eleicoes-2026.vercel.app/",
    });
    write(
      "Dados do TSE - projeto independente",
      right,
      290,
      7,
      false,
      MUTED,
      "right",
    );
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
let fontPromise: Promise<PdfFonts> | null = null;
export function loadMunicipalPdfFonts(): Promise<PdfFonts> {
  if (!fontPromise)
    fontPromise = Promise.all(
      ["Regular", "Bold"].map(async (style) => {
        const response = await fetch(`/fonts/noto-sans/NotoSans-${style}.ttf`, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok)
          throw new Error("Não foi possível preparar o PDF. Tente novamente.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        let text = "";
        for (let i = 0; i < bytes.length; i += 8192)
          text += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(text);
      }),
    )
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((error) => {
        fontPromise = null;
        throw error;
      });
  return fontPromise;
}
