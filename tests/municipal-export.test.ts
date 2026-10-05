import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import {
  initialExportRows,
  mergeExportRows,
  municipalExportSchema,
  type MunicipalExport,
} from "../lib/municipal-export";
import { municipalWorkbook } from "../lib/municipal-workbook";
import { getCandidateMunicipalVotes } from "../services/tse/service";
import { verifyOfficialJws } from "../services/tse/client";
import { parseResult } from "../services/tse/parser";

const rows = initialExportRows([
  { name: "Águas de Chapecó", code: "80098" },
  { name: "Caibi", code: "80594" },
  { name: "Riqueza", code: "83410" },
]);
const input: MunicipalExport = {
  uf: "sc",
  candidate: {
    id: "123",
    name: "Candidato de teste",
    number: "12345",
    party: "TESTE",
    office: "stateDeputy",
  },
  rows: [
    {
      ...rows[0],
      votes: 0,
      percentage: 100,
      status: "finished",
      updatedAt: "2026-10-04T22:00:00.000Z",
      verifiedSignatures: true,
      source:
        "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc80098-c0007-e006259-u.jws",
    },
    {
      ...rows[1],
      votes: 12345,
      percentage: 50,
      status: "counting",
      updatedAt: "2026-10-04T21:00:00.000Z",
      verifiedSignatures: true,
      source:
        "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sc/sc80594-c0007-e006259-u.jws",
    },
    rows[2],
  ],
};

test("exportação conserva zero, ausência, cobertura e valida cidade, cargo e fonte", () => {
  const data = municipalExportSchema.parse(input);
  assert.equal(data.rows[0].votes, 0);
  assert.equal(data.rows[2].votes, null);
  assert.equal(
    mergeExportRows(rows, data.rows.slice(0, 2), ["80098", "80594"])[2].status,
    "unqueried",
  );
  assert.throws(() =>
    mergeExportRows(rows, data.rows.slice(0, 1), ["80098", "80594"]),
  );
  assert.throws(() =>
    mergeExportRows(rows, [data.rows[0], data.rows[0]], ["80098", "80594"]),
  );
  assert.throws(() =>
    municipalExportSchema.parse({
      ...data,
      rows: [...data.rows, data.rows[0]],
    }),
  );
  assert.throws(() => municipalExportSchema.parse({ ...data, uf: "sp" }));
  assert.throws(() =>
    municipalExportSchema.parse({
      ...data,
      candidate: { ...data.candidate, office: "federalDeputy" },
    }),
  );
  assert.throws(() =>
    municipalExportSchema.parse({
      ...data,
      rows: [{ ...data.rows[0], verifiedSignatures: false }],
    }),
  );
});

test("Excel simplificado contém números, zero, células em branco, filtros e total, sem colunas técnicas", async () => {
  const bytes = await municipalWorkbook(
    input,
    new Date("2026-10-04T23:00:00Z"),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  const sheet = workbook.getWorksheet("Votos por cidade")!;
  assert.equal(sheet.rowCount, 13);
  assert.equal(sheet.getCell("A8").value, "Águas de Chapecó");
  assert.equal(sheet.getCell("B8").value, 0);
  assert.equal(sheet.getCell("B9").value, 12345);
  assert.equal(sheet.getCell("B10").value, null);
  assert.equal(sheet.columnCount, 3);
  assert.deepEqual((sheet.getRow(7).values as unknown[]).slice(1), [
    "Município",
    "Votos em 2026",
    "Observação",
  ]);
  assert.equal(sheet.getCell("C10").value, "Não consultado");
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(sheet.getCell("B5").formula, "SUM(B8:B10)");
  assert.equal(sheet.getCell("B5").result, 12345);
  assert.ok(sheet.autoFilter);
  assert.equal((sheet.views[0] as ExcelJS.WorksheetViewFrozen).ySplit, 7);
  const malicious = structuredClone(input);
  malicious.rows[0].name = '=HYPERLINK("https://example.com","x")';
  const textBook = new ExcelJS.Workbook();
  const textBytes = await municipalWorkbook(malicious);
  await textBook.xlsx.load(textBytes.buffer as ArrayBuffer);
  assert.equal(
    textBook.getWorksheet(1)!.getCell("A8").type,
    ExcelJS.ValueType.String,
  );
});

test("API de candidato confere assinatura, UF, cargo, identidade, cidades e mantém último valor em falha", async () => {
  const state = parseResult(
    verifyOfficialJws(
      readFileSync("tests/fixtures/sc-c0007-e006259-u.jws", "utf8"),
    ),
    "stateDeputy",
    "6259",
  );
  const id = String(state.carg[0].agr[0].par[0].cand[0].sqcand);
  const city = parseResult(
    verifyOfficialJws(
      readFileSync("tests/fixtures/sc80594-c0007-e006259-u.jws", "utf8"),
    ),
    "stateDeputy",
    "6259",
    "80594",
  );
  const raw = city.carg[0].agr
    .flatMap((g) => g.par.flatMap((p) => p.cand))
    .find((c) => String(c.sqcand) === id);
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  globalThis.fetch = async (url) => {
    const file = join(
      "tests/fixtures",
      new URL(String(url)).pathname.split("/").at(-1)!,
    );
    return new Response(existsSync(file) ? readFileSync(file, "utf8") : "", {
      status: existsSync(file) ? 200 : 404,
    });
  };
  try {
    const data = await getCandidateMunicipalVotes("sc", "stateDeputy", id, [
      "80594",
    ]);
    assert.equal(data.rows.length, 1);
    assert.equal(data.candidate.id, id);
    assert.equal(
      data.rows[0].votes,
      raw && ["counting", "finished"].includes(data.rows[0].status)
        ? Number(raw.vap)
        : null,
    );
    assert.equal(data.rows[0].verifiedSignatures, true);
    municipalExportSchema.parse(data);
    await assert.rejects(() =>
      getCandidateMunicipalVotes("sc", "stateDeputy", "99999999999999999999", [
        "80594",
      ]),
    );
    await assert.rejects(() =>
      getCandidateMunicipalVotes("sc", "stateDeputy", id, ["99999"]),
    );
    await assert.rejects(() =>
      getCandidateMunicipalVotes(
        "sc",
        "stateDeputy",
        id,
        Array.from({ length: 21 }, (_, i) => String(80000 + i)),
      ),
    );
    const before = originalNow();
    Date.now = () => before + 13000;
    globalThis.fetch = async (url) => {
      const name = new URL(String(url)).pathname.split("/").at(-1)!;
      if (name === "sc80594-c0007-e006259-u.jws") throw new Error("offline");
      return new Response(readFileSync(join("tests/fixtures", name), "utf8"));
    };
    const stale = await getCandidateMunicipalVotes("sc", "stateDeputy", id, [
      "80594",
    ]);
    assert.equal(stale.stale, true);
    assert.equal(stale.rows[0].votes, data.rows[0].votes);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
