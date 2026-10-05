import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultReportPersonalization,
  reportMunicipalities,
  reportComparisonTotals,
} from "../lib/report-options";
import {
  preparedReportHtml,
  type PreparedReport,
} from "../lib/report-document";
import { initialExportRows } from "../lib/municipal-export";
import {
  queryReportCities,
  reportHistoryChoices,
  reportHistoricalCandidate,
} from "../lib/report-query";
import { municipalPdf, municipalPdfSummary } from "../lib/municipal-pdf";

const candidate = {
  id: "123",
  name: "Candidata",
  fullName: "Pessoa Teste",
  number: "2210",
  party: "PL",
  office: "federalDeputy" as const,
  votes: 999,
  percentage: 4,
  rank: 8,
  officialElected: false,
  officialStatus: null,
  photoUrl: null,
  destination: null,
};
const cities = [
  { code: "80594", name: "Caibi" },
  { code: "80918", name: "Cunhataí" },
  { code: "80098", name: "Águas de Chapecó" },
];
const rows = initialExportRows(cities).map((row, i) => ({
  ...row,
  votes: i === 2 ? null : i === 1 ? 0 : 130,
  status: i === 2 ? ("unavailable" as const) : ("counting" as const),
  verifiedSignatures: i !== 2,
}));
const historical = {
  id: "456",
  name: "Candidata antiga",
  fullName: "Pessoa Teste",
  number: "2210",
  party: "PL",
  office: "federalDeputy" as const,
  votes: { "80594": 100, "80918": 0, "80098": 900 },
};
const report: PreparedReport = {
  uf: "sc",
  stateName: "Santa Catarina",
  candidate,
  meta: {
    status: "counting",
    percentage: 90,
    sections: 9,
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
  historical,
  personalization: {
    ...defaultReportPersonalization(),
    name: '<script>alert("x")</script>',
    title: "Região & <oeste>",
  },
};

test("recorte do relatório rejeita cidades de outra UF, deduplica escolhas e permite toda a UF", () => {
  assert.deepEqual(reportMunicipalities(cities, ["80594", "80594"], "cities"), [
    cities[0],
  ]);
  assert.throws(() => reportMunicipalities(cities, ["99999"], "comparison"));
  assert.throws(() => reportMunicipalities(cities, [], "cities"));
  assert.deepEqual(reportMunicipalities(cities, [], "state"), cities);
});
test("totais históricos usam somente cidades com ambos os anos, preservam base zero e ausência", () => {
  assert.deepEqual(reportComparisonTotals(rows, historical), {
    paired: 2,
    previous: 100,
    current: 130,
    difference: 30,
    relative: 0.3,
  });
  assert.equal(reportComparisonTotals([rows[1]], historical).relative, null);
  assert.deepEqual(reportComparisonTotals([rows[2]], historical), {
    paired: 0,
    previous: null,
    current: null,
    difference: null,
    relative: null,
  });
});
test("relatórios personalizados escapam textos, conservam a autoria e mostram cobertura comparativa", () => {
  for (const type of ["comparison", "cities", "state"] as const) {
    const html = preparedReportHtml({
      ...report,
      type,
      personalization: { ...report.personalization, includeCharts: false },
    });
    assert.ok(!html.includes('<script>alert("x")</script>'));
    assert.match(html, /&lt;script&gt;alert/);
    assert.match(html, /Região &amp; &lt;oeste&gt;/);
    assert.match(html, /linkedin.com\/in\/vitor-rodi/);
    assert.ok(!html.includes("<svg"));
    if (type === "comparison") {
      assert.match(html, /Totais comparados em 2 de 3/);
      assert.match(html, /Base zero/);
      assert.match(html, /\+30/);
    }
    if (type === "state") assert.match(html, /Eleição ainda não confirmada/);
  }
  assert.match(preparedReportHtml(report), /<svg/);
});

test("prévia por associação separa cidades, comparação e totais sem misturar regiões", () => {
  const html = preparedReportHtml({ ...report, separateAssociations: true });
  const sections = [...html.matchAll(/<main class="region-report">([\s\S]*?)<\/main>/g)].map(match => match[1]);
  assert.equal(sections.length, 2);
  assert.match(sections[0], /AMERIOS/);
  assert.match(sections[0], /Caibi/);
  assert.match(sections[0], /Cunhataí/);
  assert.doesNotMatch(sections[0], /Águas de Chapecó/);
  assert.match(sections[0], /Totais comparados em 2 de 2/);
  assert.match(sections[1], /AMOSC/);
  assert.match(sections[1], /Águas de Chapecó/);
  assert.doesNotMatch(sections[1], /Caibi/);
  assert.match(sections[1], /Totais comparados em 0 de 1/);
  assert.match(html, /break-before:page/);
});
test("consulta municipal faz lotes de 20, conserva escopo escolhido e rejeita candidato/municípios incorretos", async () => {
  const original = globalThis.fetch;
  const catalog = Array.from({ length: 35 }, (_, i) => ({
    code: String(80000 + i),
    name: `Cidade ${i}`,
  }));
  const batches: number[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input), "https://test.local");
    const codes = url.searchParams.get("cities")!.split(",");
    batches.push(codes.length);
    return Response.json({
      uf: "sc",
      candidate,
      rows: initialExportRows(
        catalog.filter((city) => codes.includes(city.code)),
      ),
      stale: false,
    });
  };
  try {
    let done = 0;
    const result = await queryReportCities({
      uf: "sc",
      candidate,
      municipalities: catalog,
      signal: new AbortController().signal,
      onProgress: (_, count) => {
        done = count;
      },
    });
    assert.deepEqual(batches, [20, 15]);
    assert.equal(result.length, 35);
    assert.equal(done, 35);
    globalThis.fetch = async () =>
      Response.json({
        uf: "sc",
        candidate: { ...candidate, id: "999" },
        rows,
        stale: false,
      });
    await assert.rejects(
      queryReportCities({
        uf: "sc",
        candidate,
        municipalities: cities,
        signal: new AbortController().signal,
        onProgress() {},
      }),
      /outra candidatura/,
    );
    globalThis.fetch = async () =>
      Response.json({
        uf: "sc",
        candidate,
        rows: [rows[0], rows[1], { ...rows[2], code: "99999" }],
        stale: false,
      });
    await assert.rejects(
      queryReportCities({
        uf: "sc",
        candidate,
        municipalities: cities,
        signal: new AbortController().signal,
        onProgress() {},
      }),
      /incorreta/,
    );
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      queryReportCities({
        uf: "sc",
        candidate,
        municipalities: cities,
        signal: abort.signal,
        onProgress() {},
      }),
      { name: "AbortError" },
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("identidade histórica rejeita outra candidatura e UF tanto na associação automática quanto manual", async () => {
  const original = globalThis.fetch,
    signal = new AbortController().signal;
  globalThis.fetch = async () =>
    Response.json({
      uf: "sc",
      year: 2022,
      round: 1,
      current: { id: "999", fullName: "Outra" },
      matchedId: "456",
      selected: historical,
      candidates: [historical],
    });
  try {
    await assert.rejects(
      reportHistoryChoices("sc", candidate, signal),
      /identificação/,
    );
    globalThis.fetch = async () =>
      Response.json({ uf: "sp", year: 2022, round: 1, selected: historical });
    await assert.rejects(
      reportHistoricalCandidate("sc", candidate, "456", signal),
      /outra consulta/,
    );
    globalThis.fetch = async () =>
      Response.json({ uf: "sc", year: 2022, round: 1, selected: historical });
    assert.equal(
      (await reportHistoricalCandidate("sc", candidate, "456", signal)).id,
      "456",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("PDF da central aceita mais de 30 cidades e valida a identidade do perfil estadual", () => {
  const fonts = {
    regular: readFileSync(
      "public/fonts/noto-sans/NotoSans-Regular.ttf",
    ).toString("base64"),
    bold: readFileSync("public/fonts/noto-sans/NotoSans-Bold.ttf").toString(
      "base64",
    ),
  };
  const input = {
    uf: "sc",
    candidate,
    generatedAt: report.generatedAt,
    personalization: defaultReportPersonalization(),
    rows: Array.from({ length: 35 }, (_, i) => ({
      ...rows[0],
      code: String(80000 + i),
      name: `Cidade ${i}`,
    })),
  };
  assert.equal(municipalPdfSummary(input).rows.length, 35);
  assert.equal(
    Buffer.from(municipalPdf(input, fonts)).subarray(0, 5).toString(),
    "%PDF-",
  );
  assert.throws(
    () => municipalPdf({ ...input, profile: { ...report, uf: "sp" } }, fonts),
    /outra candidatura/,
  );
});
