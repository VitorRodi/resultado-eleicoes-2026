import { test } from "node:test";
import assert from "node:assert/strict";
import { selectedMunicipalComparison } from "../lib/selected-municipal-export";
import type { Candidate } from "../types/election";

test("comparação direta consulta somente cidades selecionadas e rejeita outra candidatura ou histórico ambíguo", async () => {
  const candidate: Candidate = {
    id: "123",
    name: "João",
    fullName: "João da Silva",
    number: "2210",
    party: "PL",
    office: "federalDeputy",
    votes: 500,
    percentage: 1,
    rank: 1,
    officialStatus: null,
    officialElected: false,
    photoUrl: null,
    destination: null,
  };
  const codes = Array.from({ length: 30 }, (_, i) => String(80000 + i));
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  let posted: { rows: { code: string }[]; historyCandidateId: string } | null =
    null;
  let mode = "valid";
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/history?"))
      return Response.json({
        uf: "sc",
        year: 2022,
        round: 1,
        current: { id: "123" },
        matchedId: "456",
        selected:
          mode === "ambiguous" ? null : { ...candidate, id: "456", votes: {} },
      });
    if (String(url).includes("/candidate?")) {
      const batchCodes = new URL(
        String(url),
        "https://example.com",
      ).searchParams
        .get("cities")!
        .split(",");
      assert.ok(batchCodes.length <= 20);
      requested.push(...batchCodes);
      return Response.json({
        uf: "sc",
        candidate: { ...candidate, id: mode === "wrong" ? "999" : "123" },
        rows: batchCodes.map((code) => ({
          code,
          name: `Cidade ${code}`,
          votes: 0,
          percentage: 100,
          status: "finished",
          updatedAt: null,
          stale: false,
          verifiedSignatures: true,
          source: "",
        })),
      });
    }
    posted = JSON.parse(String(options?.body));
    return new Response("excel", {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  };
  try {
    const result = await selectedMunicipalComparison({
      uf: "sc",
      candidate,
      codes: [...codes, codes[0]],
    });
    assert.deepEqual(requested, codes);
    assert.deepEqual(
      result.data.rows.map((row) => row.code),
      codes,
    );
    assert.equal(result.data.historyCandidateId, "456");
    assert.equal((posted as unknown as { rows: unknown[] }).rows.length, 30);
    assert.equal(await result.blob.text(), "excel");
    mode = "wrong";
    await assert.rejects(
      () =>
        selectedMunicipalComparison({
          uf: "sc",
          candidate,
          codes: codes.slice(0, 2),
        }),
      /não correspondem/,
    );
    mode = "ambiguous";
    await assert.rejects(
      () =>
        selectedMunicipalComparison({
          uf: "sc",
          candidate,
          codes: codes.slice(0, 2),
        }),
      /candidatura única/,
    );
    await assert.rejects(
      () => selectedMunicipalComparison({ uf: "sc", candidate, codes: [] }),
      /Selecione/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
