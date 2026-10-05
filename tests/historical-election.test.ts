import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { BRAZIL_STATES } from "../lib/brazil-states";
import {
  findHistoricalMatch,
  voteChange,
  type HistoricalCandidate,
} from "../lib/historical-election";
import {
  historicalElection,
  historicalCandidate,
} from "../services/tse/historical";
import {
  municipalExportSchema,
  type MunicipalExport,
} from "../lib/municipal-export";
import {
  municipalWorkbook,
  municipalWorkbookName,
} from "../lib/municipal-workbook";

const historical: HistoricalCandidate = {
  id: "123",
  name: "Nome na urna antigo",
  fullName: "José da Silva",
  number: "11111",
  party: "ANTIGO",
  office: "stateDeputy",
  votes: { "80098": 100, "80594": 100, "83410": 0 },
};
test("correspondência histórica exige nome completo único, conserva mudança de número, partido e cargo", () => {
  assert.equal(findHistoricalMatch([historical], " JOSÉ  DA SILVA "), "123");
  assert.equal(findHistoricalMatch([historical], "Nome na urna antigo"), null);
  assert.equal(findHistoricalMatch([historical], "Outra pessoa"), null);
  assert.equal(
    findHistoricalMatch(
      [historical, { ...historical, id: "456", office: "federalDeputy" }],
      "José da Silva",
    ),
    null,
  );
});
test("variação preserva ganhos, perdas, zero e dados ausentes sem dividir por zero", () => {
  assert.deepEqual(voteChange(100, 130), { difference: 30, relative: 0.3 });
  assert.deepEqual(voteChange(100, 70), { difference: -30, relative: -0.3 });
  assert.deepEqual(voteChange(100, 0), { difference: -100, relative: -1 });
  assert.deepEqual(voteChange(0, 30), { difference: 30, relative: null });
  assert.deepEqual(voteChange(100, null), { difference: null, relative: null });
  assert.deepEqual(voteChange(null, 100), { difference: null, relative: null });
});
test("dados oficiais 2022 carregam todas as UFs e reconciliam totais e municípios de SC", async () => {
  for (const state of BRAZIL_STATES) {
    const data = await historicalElection(state.uf.toLowerCase());
    assert.equal(data.uf, state.uf.toLowerCase());
    assert.equal(data.round, 1);
    assert.equal(data.year, 2022);
    assert.ok(data.candidates.some((c) => c.office === "president"));
  }
  const data = await historicalElection("sc");
  assert.equal(Object.keys(data.cities).length, 295);
  for (const [id, total, caibi] of [
    ["240001610968", 84631, 47],
    ["240001614346", 26812, 0],
    ["240001614342", 31659, 43],
    ["280001607829", 1279216, 1138],
  ] as const) {
    const candidate = await historicalCandidate("sc", id);
    assert.equal(
      Object.values(candidate.votes).reduce((a, b) => a + b, 0),
      total,
    );
    assert.equal(candidate.votes["80594"], caibi);
  }
  await assert.rejects(() => historicalElection("../sc"));
  await assert.rejects(() => historicalCandidate("sp", "240001614346"));
  await assert.rejects(() => historicalCandidate("sc", "999999999999999"));
});
const exportData: MunicipalExport = {
  uf: "sc",
  historyCandidateId: historical.id,
  candidate: {
    id: "456",
    name: "Nome na urna atual",
    number: "2222",
    party: "ATUAL",
    office: "federalDeputy",
  },
  rows: [
    ["80098", "A", 130],
    ["80594", "B", 70],
    ["83410", "C", 30],
    ["80918", "D", 50],
    ["80810", "E", null],
  ].map(([code, name, votes]) => ({
    code: code as string,
    name: name as string,
    votes: votes as number | null,
    percentage: 50,
    status: votes === null ? "unavailable" : "counting",
    updatedAt: null,
    stale: false,
    verifiedSignatures: votes !== null,
    source:
      votes === null
        ? ""
        : `https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc${code}-c0006-e006259-u.jws`,
  })),
};
test("Excel compara anos com fórmulas, sinais, base zero e ausência sem colunas do TSE", async () => {
  const bytes = await municipalWorkbook(
    exportData,
    new Date("2026-10-04T23:00:00Z"),
    historical,
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes.buffer as ArrayBuffer);
  assert.deepEqual(
    book.worksheets.map((s) => s.name),
    ["Votos por cidade"],
  );
  const sheet = book.getWorksheet(1)!;
  assert.equal(sheet.columnCount, 4);
  assert.deepEqual((sheet.getRow(7).values as unknown[]).slice(1), [
    "Município",
    "Votos do candidato em 2026",
    "Votos do candidato em 2022",
    "Diferença de votos",
  ]);
  assert.equal(sheet.getCell("D8").formula, 'IF(COUNT(B8:C8)=2,B8-C8,"")');
  assert.equal(sheet.getCell("D8").result, 30);
  assert.equal(sheet.getCell("D9").result, -30);
  assert.equal(sheet.getCell("C10").value, 0);
  assert.equal(sheet.getCell("D10").result, 30);
  assert.equal(sheet.getCell("C11").value, null);
  assert.ok(!sheet.getCell("D11").result);
  assert.equal(sheet.getCell("B12").value, null);
  assert.ok(!sheet.getCell("D12").result);
  assert.match(sheet.getCell("D8").numFmt, /\+/);
  assert.match(String(sheet.getCell("A3").value), /Deputado estadual/);
  assert.match(String(sheet.getCell("A3").value), /Deputado federal/);
  assert.equal(
    municipalWorkbookName(exportData),
    "votos-por-municipio-de-nome-na-urna-atual-sc-2022-2026.xlsx",
  );
  await assert.rejects(() =>
    municipalWorkbook(exportData, new Date(), { ...historical, id: "789" }),
  );
  assert.throws(() =>
    municipalExportSchema.parse({ ...exportData, historyCandidateId: "../sc" }),
  );
});
