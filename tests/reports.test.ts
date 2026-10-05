import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import regions from "../data/municipal-regions.json";
import {
  candidateReportHtml,
  reportDistribution,
  type CandidateReport,
} from "../lib/candidate-report";
import { initialExportRows } from "../lib/municipal-export";
import { cityWorkbook } from "../lib/city-workbook";
import { getCityCandidateList } from "../services/tse/service";
import { parseResult } from "../services/tse/parser";
import { normalizeResult } from "../services/tse/normalize";
import { verifyOfficialJws } from "../services/tse/client";

const report: CandidateReport = {
  uf: "sc",
  stateName: "Santa Catarina",
  candidate: {
    id: "123",
    name: "<script>teste</script>",
    fullName: "Pessoa & teste",
    number: "2210",
    party: "PL",
    office: "federalDeputy",
    votes: 150,
    percentage: 3,
    rank: 25,
    officialStatus: "Eleito por média",
    officialElected: true,
    photoUrl: null,
    destination: null,
  },
  meta: {
    status: "counting",
    percentage: 80,
    sections: 80,
    totalSections: 100,
    updatedAt: "2026-10-04T20:00:00Z",
    generation: "1",
    seats: 16,
  },
  stateStale: false,
  generatedAt: "2026-10-04T21:00:00Z",
  municipalities: [
    { code: "80594", name: "Caibi", ibgeCode: "4203105" },
    { code: "80098", name: "Águas de Chapecó", ibgeCode: "4200507" },
    { code: "80918", name: "Cunhataí", ibgeCode: "4204756" },
  ],
  rows: [],
  regions: regions.municipalities,
};
report.rows = initialExportRows(report.municipalities).map((row, i) => ({
  ...row,
  votes: i === 2 ? null : 100,
  status: i === 2 ? "unqueried" : "counting",
  verifiedSignatures: i !== 2,
}));
test("distribuição municipal conserva empates, zero, ausência e cobertura regional parcial", () => {
  const d = reportDistribution(report);
  assert.equal(d.known, 2);
  assert.equal(d.total, 200);
  assert.equal(d.bestCities.length, 2);
  assert.equal(d.complete, false);
  assert.equal(d.regions[0].name, "Chapecó");
  assert.equal(d.regions[0].votes, 200);
  assert.equal(d.regions[0].known, 2);
  assert.ok(d.regions[0].total >= 2);
  const missing = reportDistribution({ ...report, regions: {} });
  assert.equal(missing.unmapped, 2);
  assert.equal(missing.regions.length, 0);
  const zero = reportDistribution({
    ...report,
    rows: report.rows.map((row) => ({ ...row, votes: 0 })),
  });
  assert.equal(zero.complete, true);
  assert.equal(zero.bestCities.length, 0);
  assert.equal(zero.bestRegions.length, 0);
  const stale = reportDistribution({
    ...report,
    rows: report.rows.map((row) => ({ ...row, votes: 10, stale: true })),
  });
  assert.equal(stale.complete, false);
});
test("relatório escapa textos e mostra confirmação proporcional fora do top de vagas, fonte e autoria", () => {
  const html = candidateReportHtml(report);
  assert.ok(!html.includes("<script>teste</script>"));
  assert.ok(html.includes("&lt;script&gt;teste&lt;/script&gt;"));
  assert.ok(html.includes("Eleito · confirmação oficial"));
  assert.ok(html.includes("25º"));
  assert.ok(html.includes("2 de 3 municípios"));
  assert.ok(html.includes("entre os dados disponíveis"));
  assert.ok(html.includes("<svg"));
  assert.ok(html.includes("linkedin.com/in/vitor-rodi"));
  assert.ok(html.includes("Feito por"));
  assert.ok(html.includes("regiões") || html.includes("região"));
  const unknown = candidateReportHtml({
    ...report,
    candidate: { ...report.candidate, rank: null },
    meta: { ...report.meta, status: "waiting" },
  });
  assert.ok(!unknown.includes("Eleito · confirmação oficial"));
  assert.ok(unknown.includes("Aguardando divulgação"));
});
test("lista municipal recupera todos os candidatos do arquivo assinado, não apenas os líderes, e conserva falhas", async () => {
  const expected = normalizeResult(
    parseResult(
      verifyOfficialJws(
        readFileSync("tests/fixtures/sc80594-c0001-e006257-u.jws", "utf8"),
      ),
      "president",
      "6257",
      "80594",
      "sc",
    ),
    "president",
    "https://resultados.tse.jus.br/oficial/ele2026/6257/fotos/br",
  );
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
    const data = await getCityCandidateList("sc", "president", "80594");
    assert.equal(data.candidates.length, expected.candidates.length);
    assert.ok(data.candidates.length > 2);
    assert.equal(data.verifiedSignatures, true);
    assert.equal(data.municipality.name, "CAIBI");
    assert.deepEqual(
      data.candidates.map((c) => c.votes),
      expected.candidates.map((c) => c.votes),
    );
    const bytes = await cityWorkbook(data),
      book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes.buffer as ArrayBuffer);
    const sheet = book.getWorksheet(1)!;
    assert.deepEqual((sheet.getRow(5).values as unknown[]).slice(1), [
      "Candidato",
      "Votos",
    ]);
    assert.equal(sheet.getCell("A6").value, data.candidates[0].name);
    assert.equal(sheet.getCell("B6").value, data.candidates[0].votes);
    assert.equal(sheet.columnCount, 2);
    assert.equal(
      (
        sheet.getCell(8 + data.candidates.length, 1)
          .value as ExcelJS.CellHyperlinkValue
      ).hyperlink,
      "https://br.linkedin.com/in/vitor-rodi",
    );
    const now = originalNow();
    Date.now = () => now + 13000;
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const stale = await getCityCandidateList("sc", "president", "80594");
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.candidates, data.candidates);
    await assert.rejects(() =>
      getCityCandidateList("sp", "president", "80594"),
    );
    await assert.rejects(() => cityWorkbook({ ...data, status: "waiting" }));
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
