import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { initialExportRows, municipalExportSchema } from "../lib/municipal-export";
import { municipalWorkbook } from "../lib/municipal-workbook";
import { preparedReportHtml, type PreparedReport } from "../lib/report-document";
import { defaultReportPersonalization } from "../lib/report-options";

const candidate = {
  id: "123",
  name: "Pessoa Teste",
  fullName: "Pessoa Teste",
  number: "2210",
  party: "PL",
  office: "federalDeputy" as const,
  votes: 400,
  percentage: 4,
  rank: 8,
  officialElected: false,
  officialStatus: null,
  photoUrl: null,
  destination: null,
};
const historical = {
  ...candidate,
  id: "456",
  votes: { "80594": 90, "80918": 102, "81910": 120, "80098": 0, "80950": 60 },
};
const cities = [
  { code: "80594", name: "Caibi" },
  { code: "80918", name: "Cunhataí" },
  { code: "81910", name: "Mondaí" },
  { code: "80098", name: "Águas de Chapecó" },
  { code: "80200", name: "Anchieta" },
  { code: "80950", name: "Dionísio Cerqueira" },
];
const rows = initialExportRows(cities).map((row, i) => ({
  ...row,
  votes: [103, 102, 103, 0, 70, null][i],
  status: i === 5 ? ("unavailable" as const) : ("finished" as const),
  verifiedSignatures: i !== 5,
}));
const report: PreparedReport = {
  uf: "sc",
  stateName: "Santa Catarina",
  candidate,
  historical,
  meta: {
    status: "finished",
    percentage: 100,
    sections: 10,
    totalSections: 10,
    updatedAt: null,
    generation: null,
    seats: 16,
  },
  stateStale: false,
  generatedAt: "2026-10-05T01:00:00Z",
  municipalities: cities,
  rows,
  regions: {},
  type: "comparison",
  personalization: { ...defaultReportPersonalization(), includeCharts: false },
};

test("prévia calcula projeção somente quando selecionada e preserva zero e dados ausentes", () => {
  const selection = { ...report, includeProjection: true };
  const html = preparedReportHtml(selection);
  assert.match(html, /<th>Projeção 2030<\/th>/);
  for (const [city, votes] of [
    ["Caibi", "124"],
    ["Cunhataí", "122"],
    ["Mondaí", "144"],
    ["Águas de Chapecó", "0"],
    ["Anchieta", "—"],
    ["Dionísio Cerqueira", "—"],
  ]) {
    const row = html.match(new RegExp(`<tr><td>${city}</td>[^]*?</tr>`))?.[0];
    assert.ok(row?.endsWith(`<td>${votes}</td></tr>`), row);
  }
  assert.doesNotMatch(preparedReportHtml(report), /Projeção 2030/);
});

test("Excel leva a projeção às abas regionais e soma as estimativas municipais", async () => {
  const selection = {
    uf: "sc",
    candidate,
    rows,
    historyCandidateId: historical.id,
    separateAssociations: true,
    includeProjection: true,
  };
  const book = new ExcelJS.Workbook();
  const bytes = await municipalWorkbook(selection, new Date(report.generatedAt), historical);
  await book.xlsx.load(bytes.buffer as ArrayBuffer);
  const main = book.getWorksheet("Votos por cidade")!;
  assert.equal(main.getCell("G7").value, "Projeção 2030");
  assert.equal(main.getCell("G8").result, 0);
  assert.equal(main.getCell("G10").result, 124);
  assert.equal(main.getCell("G11").result, 122);
  assert.equal(main.getCell("G13").result, 144);
  const am = book.getWorksheet("AMERIOS")!;
  assert.equal(am.getCell("G10").result, 246);
  const regions = book.getWorksheet("Regiões")!;
  regions.eachRow((row) => {
    if (row.getCell(1).value === "AMERIOS") assert.equal(row.getCell(7).value, 246);
    if (row.getCell(1).value === "AMEOSC") assert.equal(row.getCell(7).value, null);
  });
});

test("percentuais escolhidos alteram a prévia, as fórmulas e o total regional do Excel", async () => {
  const options = {
    includeProjection: true,
    projectionRates: { growth: 12.5, decline: 55 },
  };
  const html = preparedReportHtml({ ...report, ...options });
  assert.match(html, /<tr><td>Caibi<\/td>[^]*?<td>116<\/td><\/tr>/);
  assert.match(html, /<tr><td>Cunhataí<\/td>[^]*?<td>115<\/td><\/tr>/);
  assert.match(html, /<tr><td>Mondaí<\/td>[^]*?<td>160<\/td><\/tr>/);
  assert.match(html, /12,5% onde houve alta ou empate e 55% onde houve queda/);

  const selection = {
    ...options,
    uf: "sc",
    candidate,
    rows,
    historyCandidateId: historical.id,
    separateAssociations: true,
  };
  const book = new ExcelJS.Workbook();
  const bytes = await municipalWorkbook(selection, new Date(report.generatedAt), historical);
  await book.xlsx.load(bytes.buffer as ArrayBuffer);
  const main = book.getWorksheet("Votos por cidade")!;
  assert.equal(main.getCell("G10").result, 116);
  assert.equal(main.getCell("G11").result, 115);
  assert.equal(main.getCell("G13").result, 160);
  assert.match(main.getCell("G10").formula, /IF\(B10<C10,55,12\.5\)/);
  assert.equal(book.getWorksheet("AMERIOS")!.getCell("G10").result, 231);
});

test("exportação aceita percentuais zero ou decimal e rejeita acréscimos negativos", () => {
  const selection = {
    uf: "sc",
    candidate,
    rows,
    historyCandidateId: historical.id,
    includeProjection: true,
  };
  assert.deepEqual(municipalExportSchema.parse({
    ...selection,
    projectionRates: { growth: 0, decline: 1.5 },
  }).projectionRates, { growth: 0, decline: 1.5 });
  assert.equal(municipalExportSchema.safeParse({
    ...selection,
    projectionRates: { growth: 0, decline: -1 },
  }).success, false);
});
