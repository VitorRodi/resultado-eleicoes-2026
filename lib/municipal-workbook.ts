import ExcelJS from "exceljs";
import { municipalityAssociation, SC_ASSOCIATIONS, groupAssociationRows } from "./sc-associations";
import { officeLabel } from "./config";
import { municipalDownloadName } from "./export-filenames";
import {
  municipalExportSchema,
  type MunicipalExport,
  type MunicipalExportRow,
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
function addMunicipalSheet(
  workbook: ExcelJS.Workbook,
  data: MunicipalExport,
  rows: MunicipalExportRow[],
  history?: HistoricalCandidate,
  sheetName = "Votos por cidade",
  regionName?: string,
) {
  const identity = `${data.candidate.name} (${data.candidate.number} · ${data.candidate.party}) · ${officeLabel(data.candidate.office, data.uf)} · ${data.uf.toUpperCase()}`;
  const withRegions = data.uf === "sc" && (data.includeAssociations === true || data.separateAssociations === true);
  const columns = (history ? 5 : 2) + (withRegions ? 1 : 0);
  const note = [
    "Primeiro turno. Células vazias indicam votos indisponíveis; zero é um resultado divulgado.",
    rows.some((row) => row.stale)
      ? "2026 inclui últimos valores disponíveis após falha de atualização."
      : "Os votos de 2026 podem estar parciais.",
  ].join(" ");
  const sheet = setup(
    workbook,
    sheetName,
    [...(history ? [38, 28, 28, 28, 24] : [44, 28]), ...(withRegions ? [24] : [])],
    history
      ? "Votos por município · 2022 x 2026"
      : "Votos por município · 2026",
    history
      ? `2026: ${identity}\n2022: ${history.name} (${history.number} · ${history.party}) · ${officeLabel(history.office, data.uf)}`
      : identity,
    regionName ? `${regionName}. ${note}` : note,
  );
  const headers = [
    "Município",
    "Votos do candidato em 2026",
    ...(history
      ? ["Votos do candidato em 2022", "Diferença de votos", "Variação (%)"]
      : []),
    ...(withRegions ? ["Região"] : []),
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
      ...(withRegions ? [municipalityAssociation(row) || "Não identificada"] : []),
    ];
    rowStyle(sheet, at, columns);
    if (withRegions) sheet.getCell(at, columns).alignment = { vertical: "middle", horizontal: "left" };
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
  if (regionName) {
    const at = rows.length + 8;
    const current = rows.every(row => row.votes !== null) ? rows.reduce((sum, row) => sum + row.votes!, 0) : null;
    const previous = history && rows.every(row => Object.hasOwn(history.votes, row.code)) ? rows.reduce((sum, row) => sum + history.votes[row.code], 0) : null;
    const change = voteChange(previous, current);
    sheet.getRow(at).values = ["Total da região",
      { formula: `IF(COUNT(B8:B${at - 1})=${rows.length},SUM(B8:B${at - 1}),"")`, result: current ?? "" },
      ...(history ? [
        { formula: `IF(COUNT(C8:C${at - 1})=${rows.length},SUM(C8:C${at - 1}),"")`, result: previous ?? "" },
        { formula: `IF(COUNT(B${at}:C${at})=2,B${at}-C${at},"")`, result: change.difference ?? "" },
        { formula: `IF(OR(COUNT(B${at}:C${at})<2,C${at}=0),"",D${at}/C${at})`, result: change.relative ?? "" },
      ] : [])];
    rowStyle(sheet, at, columns);
    sheet.getCell(at, 2).numFmt = "#,##0";
    if (history) {
      sheet.getCell(at, 3).numFmt = "#,##0";
      sheet.getCell(at, 4).numFmt = "+#,##0;-#,##0;0";
      sheet.getCell(at, 5).numFmt = "+0.00%;-0.00%;0.00%";
    }
    sheet.getRow(at).eachCell(cell => { cell.font = { name: "Arial", size: 11, bold: true, color: { argb: GREEN } }; });
  }
  const footer = rows.length + 10;
  sheet.mergeCells(footer, 1, footer, columns);
  sheet.getCell(footer, 1).value = {
    text: "Relatório feito por Vitor Rodi · Conheça o projeto e acompanhe meu trabalho no LinkedIn",
    hyperlink: "https://br.linkedin.com/in/vitor-rodi",
  };
  sheet.getCell(footer, 1).font = {
    name: "Arial",
    size: 10,
    color: { argb: GREEN },
    underline: true,
  };
  sheet.getCell(footer, 1).alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(footer).height = 34;
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
  addMunicipalSheet(workbook, data, rows, history);
  const identity = `${data.candidate.name} (${data.candidate.number} · ${data.candidate.party}) · ${officeLabel(data.candidate.office, data.uf)} · ${data.uf.toUpperCase()}`;
  const withRegions = data.uf === "sc" && (data.includeAssociations === true || data.separateAssociations === true);
  if (withRegions) {
    const groups = SC_ASSOCIATIONS.map(region => ({ region, cities: rows.filter(row => municipalityAssociation(row) === region.id) })).filter(group => group.cities.length);
    const regionSheet = setup(workbook, "Regiões", history ? [24, 22, 26, 26, 26, 22] : [24, 22, 26], history ? "Votos por região · 2022 x 2026" : "Votos por região · 2026", identity, "Associações de municípios de Santa Catarina. Totais consideram as cidades selecionadas; se faltar votação em alguma cidade, o total daquele ano fica vazio.");
    const regionHeaders = ["Região", "Municípios selecionados", "Votos em 2026", ...(history ? ["Votos em 2022", "Diferença de votos", "Variação (%)"] : [])];
    tableHeader(regionSheet, regionHeaders, groups.length);
    for (const [index, group] of groups.entries()) {
      const at = index + 8;
      const current = group.cities.every(city => city.votes !== null) ? group.cities.reduce((sum, city) => sum + city.votes!, 0) : null;
      const previous = history && group.cities.every(city => Object.hasOwn(history.votes, city.code)) ? group.cities.reduce((sum, city) => sum + history.votes[city.code], 0) : null;
      const change = voteChange(previous, current);
      regionSheet.getRow(at).values = [group.region.id, group.cities.length, current, ...(history ? [previous,
        { formula: `IF(COUNT(C${at}:D${at})=2,C${at}-D${at},"")`, result: current !== null && previous !== null ? current - previous : "" },
        { formula: `IF(OR(COUNT(C${at}:D${at})<2,D${at}=0),"",E${at}/D${at})`, result: change.relative ?? "" }] : [])];
      rowStyle(regionSheet, at, regionHeaders.length);
      for (let column = 2; column <= 4; column++) if (column <= regionHeaders.length) regionSheet.getCell(at, column).numFmt = "#,##0";
      if (history) {
        regionSheet.getCell(at, 5).numFmt = "+#,##0;-#,##0;0";
        regionSheet.getCell(at, 6).numFmt = "+0.00%;-0.00%;0.00%";
      }
    }
    const at = groups.length + 10;
    regionSheet.mergeCells(at, 1, at, regionHeaders.length);
    regionSheet.getCell(at, 1).value = { text: "Relatório feito por Vitor Rodi · Conheça o projeto e acompanhe meu trabalho no LinkedIn", hyperlink: "https://br.linkedin.com/in/vitor-rodi" };
    regionSheet.getCell(at, 1).font = { name: "Arial", size: 10, color: { argb: GREEN }, underline: true };
    regionSheet.getCell(at, 1).alignment = { wrapText: true, vertical: "middle" };
    regionSheet.getRow(at).height = 34;
  }
  if (data.uf === "sc" && data.separateAssociations) {
    for (const group of groupAssociationRows(rows)) {
      addMunicipalSheet(workbook, data, group.rows, history, group.id, group.name);
    }
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export function municipalWorkbookName(data: MunicipalExport) {
  return municipalDownloadName(data, "xlsx");
}
