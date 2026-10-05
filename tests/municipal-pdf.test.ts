import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  municipalPdf,
  municipalPdfSummary,
  type MunicipalPdfInput,
} from "../lib/municipal-pdf";
const input: MunicipalPdfInput = {
  uf: "sc",
  candidate: {
    id: "123",
    name: "DANIELA REINEHR",
    fullName: "DANIELA CRISTINA REINEHR",
    number: "2210",
    party: "PL",
    office: "federalDeputy",
    votes: 99999,
    percentage: 3,
    rank: 11,
    officialStatus: "Eleito por QP",
    officialElected: true,
    photoUrl: null,
    destination: null,
  },
  generatedAt: "2026-10-04T23:00:00Z",
  rows: [
    {
      code: "80594",
      name: "Caibi",
      votes: 130,
      percentage: 100,
      status: "finished",
      updatedAt: "2026-10-04T22:00:00Z",
    },
    {
      code: "80098",
      name: "Águas de Chapecó",
      votes: 0,
      percentage: 100,
      status: "finished",
      updatedAt: "2026-10-04T21:00:00Z",
    },
    {
      code: "80918",
      name: "Cunhataí",
      votes: null,
      percentage: null,
      status: "unavailable",
      updatedAt: null,
    },
  ],
};
test("PDF municipal usa somente as cidades escolhidas, conserva zero, ausência e valores anteriores", () => {
  const summary = municipalPdfSummary(input);
  assert.equal(summary.rows.length, 3);
  assert.equal(summary.total, 130);
  assert.equal(summary.available, 2);
  assert.equal(summary.partial, true);
  assert.equal(summary.rows[1].votes, 0);
  assert.equal(summary.rows[2].votes, null);
  assert.equal(summary.lastUpdate, "2026-10-04T22:00:00Z");
  assert.equal(
    municipalPdfSummary({ ...input, rows: [{ ...input.rows[1], stale: true }] })
      .stale,
    true,
  );
  assert.equal(
    municipalPdfSummary({ ...input, rows: [input.rows[1]] }).partial,
    false,
  );
  assert.throws(() =>
    municipalPdfSummary({ ...input, rows: [{ ...input.rows[0], votes: -1 }] }),
  );
  assert.throws(() =>
    municipalPdfSummary({
      ...input,
      rows: [{ ...input.rows[0], votes: 0, status: "waiting" }],
    }),
  );
  assert.throws(() =>
    municipalPdfSummary({ ...input, rows: [input.rows[0], input.rows[0]] }),
  );
});
test("PDF é um documento real, com fontes Unicode incorporadas e links de autoria", () => {
  const fonts = {
    regular: readFileSync(
      "public/fonts/noto-sans/NotoSans-Regular.ttf",
    ).toString("base64"),
    bold: readFileSync("public/fonts/noto-sans/NotoSans-Bold.ttf").toString(
      "base64",
    ),
  };
  const bytes = municipalPdf(input, fonts),
    text = Buffer.from(bytes).toString("latin1");
  assert.equal(text.slice(0, 5), "%PDF-");
  assert.ok(bytes.length > 10000);
  assert.match(text, /\/FontFile2/);
  assert.match(text, /https:\/\/br.linkedin.com\/in\/vitor-rodi/);
  assert.match(text, /Vitor Rodi/);
  assert.throws(() => municipalPdf({ ...input, rows: [input.rows[2]] }, fonts));
});
