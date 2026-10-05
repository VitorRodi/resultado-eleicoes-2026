import ExcelJS from "exceljs";
import { officeLabel } from "./config";
import { municipalDownloadName } from "./export-filenames";
import {
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
  sheet.getRow(7).height = 44;
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
  workbook.creator = "Vitor Rodi";
  workbook.created = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const identity = `${data.candidate.name} (${data.candidate.number} · ${data.candidate.party}) · ${officeLabel(data.candidate.office, data.uf)} · ${data.uf.toUpperCase()}`;
  const columns = history ? 5 : 2;
  const note = [
    "Primeiro turno. Células vazias indicam votos indisponíveis; zero é um resultado divulgado.",
    rows.some((row) => row.stale)
      ? "2026 inclui últimos valores disponíveis após falha de atualização."
      : "Os votos de 2026 podem estar parciais.",
  ].join(" ");
  const sheet = setup(
    workbook,
    "Votos por cidade",
    history ? [38, 28, 28, 28, 24] : [44, 28],
    history
      ? "Votos por município · 2022 x 2026"
      : "Votos por município · 2026",
    history
      ? `2026: ${identity}\n2022: ${history.name} (${history.number} · ${history.party}) · ${officeLabel(history.office, data.uf)}`
      : identity,
    note,
  );
  const headers = [
    "Município",
    "Votos do candidato em 2026",
    ...(history
      ? ["Votos do candidato em 2022", "Diferença de votos", "Variação (%)"]
      : []),
  ];
  tableHeader(sheet, headers, rows.length);
  for (const [i, row] of rows.entries()) {
    const at = i + 8;
    const previous = history?.votes[row.code] ?? null;
    const change = voteChange(previous, row.votes);
    sheet.getRow(at).values = [
      row.name,
      row.votes,
      ...(history
        ? [
            previous,
            {
              formula: `IF(COUNT(B${at}:C${at})=2,B${at}-C${at},"")`,
              result:
                row.votes !== null && previous !== null
                  ? row.votes - previous
                  : "",
            },
            {
              formula: `IF(OR(COUNT(B${at}:C${at})<2,C${at}=0),"",D${at}/C${at})`,
              result: change.relative ?? "",
            },
          ]
        : []),
    ];
    rowStyle(sheet, at, columns);
    sheet.getCell(at, 2).numFmt = "#,##0";
    if (history) {
      sheet.getCell(at, 3).numFmt = "#,##0";
      sheet.getCell(at, 4).numFmt = "+#,##0;-#,##0;0";
      sheet.getCell(at, 5).numFmt = "+0.00%;-0.00%;0.00%";
    }
  }
  if (history) {
    sheet.mergeCells(5, 1, 5, columns);
    sheet.getCell("A5").value =
      "Diferença = 2026 − 2022. Variação = diferença ÷ 2022; base zero fica sem percentual.";
    sheet.getCell("A5").font = {
      name: "Arial",
      size: 11,
      color: { argb: GREEN },
    };
    sheet.addConditionalFormatting({
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
  const footer = rows.length + 10;
  sheet.mergeCells(footer, 1, footer, columns);
  sheet.getCell(footer, 1).value = {
    text: "Feito por Vitor Rodi · LinkedIn: linkedin.com/in/vitor-rodi",
    hyperlink: "https://br.linkedin.com/in/vitor-rodi",
  };
  sheet.getCell(footer, 1).font = {
    name: "Arial",
    size: 10,
    color: { argb: GREEN },
    underline: true,
  };
  sheet.getRow(footer).height = 25;
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export function municipalWorkbookName(data: MunicipalExport) {
  return municipalDownloadName(data, "xlsx");
}
