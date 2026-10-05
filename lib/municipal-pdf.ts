import { jsPDF } from "jspdf";
import type { Candidate, MunicipalVote } from "../types/election";
import { BRAZIL_STATES } from "./brazil-states";
import { officeLabel } from "./config";
import { sumRegional } from "./tracking";
import { number } from "./formatting";

export type MunicipalPdfInput = {
  uf: string;
  candidate: Candidate;
  rows: MunicipalVote[];
  generatedAt: string;
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
    input.rows.length > 30
  )
    throw new Error("Selecione de 1 a 30 municípios nesta UF.");
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
  const summary = municipalPdfSummary(input);
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
    title: `${clean(input.candidate.name)} - Votos nos municípios selecionados`,
    author: "Vitor Rodi",
    subject: `Eleições 2026 - ${input.uf.toUpperCase()} - primeiro turno`,
    creator: "Resultado Eleições 2026",
  });
  const left = 18,
    right = 192,
    width = 174;
  let y = 0;
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
      write(clean(input.candidate.name), left, 36, 14, true);
      write(
        "Votação nos municípios selecionados - continuação",
        left,
        44,
        9,
        false,
        MUTED,
      );
      y = 53;
      return;
    }
    write("Votação nos municípios selecionados", left, 37, 10, false, MUTED);
    doc.setFont("NotoSans", "bold");
    doc.setFontSize(21);
    const title = doc.splitTextToSize(
      clean(input.candidate.name),
      width,
    ) as string[];
    for (const [i, line] of title.entries())
      write(line, left, 49 + i * 8, 21, true);
    y = 49 + title.length * 8;
    doc.setFontSize(9);
    const identity = doc.splitTextToSize(
      `${officeLabel(input.candidate.office, input.uf)} - ${input.candidate.number} - ${input.candidate.party} - ${BRAZIL_STATES.find((state) => state.uf.toLowerCase() === input.uf)!.name}`,
      width,
    ) as string[];
    for (const line of identity) {
      write(line, left, y, 9, false, MUTED);
      y += 4.8;
    }
    y += 9;
    doc.setDrawColor(213, 223, 218);
    doc.setLineWidth(0.3);
    doc.line(left, y - 5, right, y - 5);
    write("Votos nas cidades escolhidas", left, y, 8, false, MUTED);
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
    write(
      summary.partial
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
  function tableHeader() {
    doc.setFillColor(...GREEN);
    doc.rect(left, y - 5, width, 10, "F");
    write("Município", left + 3, y + 1, 9, true, [255, 255, 255]);
    write("Comparação visual", 113, y + 1, 8, true, [255, 255, 255]);
    write("Votos", right - 3, y + 1, 9, true, [255, 255, 255], "right");
    y += 9;
  }
  startPage();
  tableHeader();
  const max = Math.max(1, ...summary.rows.map((row) => row.votes ?? 0));
  for (const [i, row] of summary.rows.entries()) {
    doc.setFont("NotoSans", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(clean(row.name), 86) as string[];
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
    if (row.votes !== null) {
      doc.setFillColor(222, 233, 225);
      doc.roundedRect(113, y - 1, 50, 3.5, 1, 1, "F");
      if (row.votes > 0) {
        doc.setFillColor(...GREEN);
        doc.roundedRect(113, y - 1, (50 * row.votes) / max, 3.5, 1, 1, "F");
      }
      write(number(row.votes), right - 3, y + 2, 10, true, INK, "right");
    } else write("Sem dados", right - 3, y + 2, 8, false, MUTED, "right");
    y += height;
  }
  if (y + 22 > 267) {
    doc.addPage();
    startPage(true);
  }
  y += 5;
  write(
    "Barras proporcionais à cidade com maior votação neste conjunto.",
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
