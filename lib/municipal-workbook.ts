import ExcelJS from "exceljs";
import { officeLabel } from "./config";
import {
  exportRowStatus,
  municipalExportSchema,
  type MunicipalExport,
} from "./municipal-export";
import {
  historicalCandidateSchema,
  voteChange,
  type HistoricalCandidate,
} from "./historical-election";

const INK = "FF1B2C32",
  GREEN = "FF17655C",
  PALE = "FFF0F5F2";
function setup(
  workbook: ExcelJS.Workbook,
  name: string,
  widths: number[],
  title: string,
  identity: string,
  note: string,
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 7, xSplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: GREEN } },
  });
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
  for (const row of [2, 3, 4]) sheet.mergeCells(row, 1, row, widths.length);
  sheet.getCell("A2").value = title;
  sheet.getCell("A2").font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: GREEN },
  };
  sheet.getRow(2).height = 28;
  sheet.getCell("A3").value = identity;
  sheet.getCell("A3").font = { name: "Arial", size: 11, color: { argb: INK } };
  sheet.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(3).height = 48;
  sheet.getCell("A4").value = note;
  sheet.getCell("A4").font = {
    name: "Arial",
    size: 10,
    italic: true,
    color: { argb: "FF53656B" },
  };
  sheet.getCell("A4").alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(4).height = 44;
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: "7:7",
  };
  return sheet;
}
function tableHeader(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  count: number,
) {
  sheet.getRow(7).values = headers;
  sheet.getRow(7).height = 32;
  for (let i = 1; i <= headers.length; i++) {
    const cell = sheet.getCell(7, i);
    cell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    cell.alignment = {
      horizontal: i === 1 ? "left" : "center",
      vertical: "middle",
      wrapText: true,
    };
  }
  sheet.autoFilter = {
    from: "A7",
    to: { row: 7 + count, column: headers.length },
  };
}
function rowStyle(sheet: ExcelJS.Worksheet, index: number, columns: number) {
  const row = sheet.getRow(index);
  row.height = 27;
  for (let i = 1; i <= columns; i++) {
    const cell = row.getCell(i);
    cell.font = { name: "Arial", size: 11, color: { argb: INK } };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 1 ? "left" : "right",
    };
    if (index % 2 === 1)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: PALE },
      };
  }
}
export async function municipalWorkbook(
  input: MunicipalExport,
  generatedAt = new Date(),
  historical?: HistoricalCandidate,
) {
  const data = municipalExportSchema.parse(input),
    rows = [...data.rows].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const history = historical
    ? historicalCandidateSchema.parse(historical)
    : undefined;
  if (data.historyCandidateId && history?.id !== data.historyCandidateId)
    throw new Error("Candidatura histórica não corresponde à seleção.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Painel Eleições 2026 · Vitor Rodi";
  workbook.created = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const identity = `${data.candidate.name} (${data.candidate.number} · ${data.candidate.party}) · ${officeLabel(data.candidate.office, data.uf)} · ${data.uf.toUpperCase()}`;
  const missing = rows.some((row) => row.votes === null || row.stale),
    columns = missing ? 3 : 2;
  const sheet = setup(
    workbook,
    "Votos por cidade",
    missing ? [38, 20, 54] : [44, 25],
    "Votos por município · 2026",
    identity,
    "Primeiro turno. A apuração de 2026 pode estar parcial. Células vazias indicam votos indisponíveis.",
  );
  sheet.getCell("A5").value = "Total de votos disponíveis";
  sheet.getCell("A5").font = { name: "Arial", size: 11, bold: true };
  sheet.getCell("B5").value = {
    formula: `SUM(B8:B${7 + rows.length})`,
    result: rows.reduce((sum, row) => sum + (row.votes ?? 0), 0),
  };
  sheet.getCell("B5").numFmt = "#,##0";
  tableHeader(
    sheet,
    missing
      ? ["Município", "Votos em 2026", "Observação"]
      : ["Município", "Votos em 2026"],
    rows.length,
  );
  for (const [i, row] of rows.entries()) {
    const line = sheet.getRow(i + 8);
    line.values = missing
      ? [
          row.name,
          row.votes,
          row.votes === null
            ? exportRowStatus(row)
            : row.stale
              ? "Último resultado disponível"
              : "",
        ]
      : [row.name, row.votes];
    rowStyle(sheet, i + 8, columns);
    line.getCell(2).numFmt = "#,##0";
    if (missing)
      line.getCell(3).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
  }
  if (history) {
    const values = rows.map((row) => ({
      ...row,
      previous: history.votes[row.code] ?? null,
    }));
    const showNote = values.some(
      (row) =>
        row.previous === null ||
        row.votes === null ||
        row.previous === 0 ||
        row.stale,
    );
    const headers = [
      "Município",
      "Votos em 2022",
      "Votos em 2026",
      "Diferença de votos",
      "Variação (%)",
      ...(showNote ? ["Observação"] : []),
    ];
    const comparison = setup(
      workbook,
      "Comparação 2022 x 2026",
      showNote ? [35, 19, 19, 22, 19, 58] : [38, 19, 19, 22, 19],
      "Votos por município · 2022 x 2026",
      `2022: ${history.name} (${history.number} · ${history.party}) · ${officeLabel(history.office, data.uf)}\n2026: ${identity}`,
      "Primeiro turno nos dois anos. 2026 pode estar parcial. Variação = diferença ÷ votos de 2022; sem porcentagem quando a base é zero ou ausente.",
    );
    comparison.mergeCells(5, 1, 5, headers.length);
    comparison.getCell("A5").value =
      "Diferença = votos de 2026 − votos de 2022";
    comparison.getCell("A5").font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: GREEN },
    };
    tableHeader(comparison, headers, rows.length);
    for (const [i, row] of values.entries()) {
      const at = i + 8,
        change = voteChange(row.previous, row.votes);
      const note =
        row.previous === null
          ? "Sem resultado de 2022 neste município"
          : row.votes === null
            ? exportRowStatus(row)
            : row.previous === 0
              ? "Base 2022 igual a zero; variação % não se aplica"
              : row.stale
                ? "2026: último resultado disponível"
                : "";
      comparison.getRow(at).values = [
        row.name,
        row.previous,
        row.votes,
        {
          formula: `IF(COUNT(B${at}:C${at})=2,C${at}-B${at},"")`,
          result: change.difference ?? "",
        },
        {
          formula: `IF(OR(COUNT(B${at}:C${at})<2,B${at}=0),"",(C${at}-B${at})/B${at})`,
          result: change.relative ?? "",
        },
        ...(showNote ? [note] : []),
      ];
      rowStyle(comparison, at, headers.length);
      for (const col of [2, 3]) comparison.getCell(at, col).numFmt = "#,##0";
      comparison.getCell(at, 4).numFmt = "+#,##0;-#,##0;0";
      comparison.getCell(at, 5).numFmt = "+0.00%;-0.00%;0.00%";
      if (showNote)
        comparison.getCell(at, 6).alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
    }
    comparison.addConditionalFormatting({
      ref: `D8:E${7 + rows.length}`,
      rules: [
        {
          type: "cellIs",
          operator: "greaterThan",
          formulae: ["0"],
          priority: 1,
          style: { font: { color: { argb: GREEN }, bold: true } },
        },
        {
          type: "cellIs",
          operator: "lessThan",
          formulae: ["0"],
          priority: 2,
          style: { font: { color: { argb: "FFB13C46" }, bold: true } },
        },
      ],
    });
  }
  for (const page of workbook.worksheets) {
    const footer = rows.length + 10;
    page.mergeCells(footer, 1, footer, page.columnCount);
    page.getCell(footer, 1).value = {
      text: "Feito por Vitor Rodi · LinkedIn",
      hyperlink: "https://br.linkedin.com/in/vitor-rodi",
    };
    page.getCell(footer, 1).font = {
      name: "Arial",
      size: 10,
      color: { argb: GREEN },
      underline: true,
    };
    page.getRow(footer).height = 25;
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export function municipalWorkbookName(data: MunicipalExport) {
  return `${data.historyCandidateId ? "comparacao-2022-2026" : "votos-por-cidade"}-${data.uf}-${data.candidate.number}-${data.candidate.id}.xlsx`;
}
