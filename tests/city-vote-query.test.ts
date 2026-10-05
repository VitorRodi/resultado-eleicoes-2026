import { test } from "node:test";
import assert from "node:assert/strict";
import { findCities, findCityCandidates } from "../lib/city-vote-query";
import { requestCityVotes } from "../lib/city-vote-request";
import type { CityResults } from "../lib/city-results";

const selection = { uf: "sc", office: "stateDeputy" as const, city: "80594" };
const data: CityResults = {
  uf: "sc", office: "stateDeputy", municipality: { code: "80594", name: "CAIBI" },
  candidates: [
    { id: "1", name: "OSCAR GUTZ", number: "22470", party: "PL", votes: 21 },
    { id: "2", name: "ALTAIR SILVA", number: "11130", party: "PP", votes: 983 },
    { id: "3", name: "JOÃO SEM VOTOS", number: "22200", party: "PL", votes: 0 },
    { id: "4", name: "ANA SEM DADOS", number: "13456", party: "PT", votes: null },
  ], status: "counting", updatedAt: null, stale: false, verifiedSignatures: true,
};

test("pesquisa de cidades ignora acentos, aceita palavras fora de ordem e prioriza nome exato", () => {
  const cities = [
    { code: "10000", name: "São Carlos do Sul" },
    { code: "10001", name: "São Carlos" },
    { code: "10002", name: "Cunhataí" },
  ];
  assert.deepEqual(findCities(cities, "carlos sao").map(c => c.code), ["10001", "10000"]);
  assert.equal(findCities(cities, "cunhatai")[0].code, "10002");
  assert.equal(findCities(cities, "sao carlos")[0].code, "10001");
  assert.equal(findCities(cities, "inexistente").length, 0);
  assert.equal(cities[0].code, "10000");
});

test("busca candidatos por nome, número e partido sem perder zeros, ausências ou a lista completa", () => {
  assert.equal(findCityCandidates(data.candidates, "gutz oscar", "votes")[0].id, "1");
  assert.equal(findCityCandidates(data.candidates, "22470", "votes")[0].id, "1");
  assert.deepEqual(findCityCandidates(data.candidates, "pl", "votes").map(c => c.id), ["1", "3"]);
  assert.equal(findCityCandidates(data.candidates, "joao", "votes")[0].votes, 0);
  assert.deepEqual(findCityCandidates(data.candidates, "", "votes").map(c => c.id), ["2", "1", "3", "4"]);
  assert.equal(findCityCandidates(data.candidates, "", "name")[0].id, "2");
  assert.equal(data.candidates.length, 4);
  assert.equal(data.candidates[0].id, "1");
});

test("consulta rejeita outra UF, cargo, cidade e dados sem verificação", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json(data);
    assert.deepEqual(await requestCityVotes(selection, new AbortController().signal), data);
    for (const wrong of [{ ...data, uf: "sp" }, { ...data, office: "president" },
      { ...data, municipality: { code: "81582", name: "Cunhataí" } }, { ...data, verifiedSignatures: false }]) {
      globalThis.fetch = async () => Response.json(wrong);
      await assert.rejects(requestCityVotes(selection, new AbortController().signal));
    }
  } finally { globalThis.fetch = original; }
});

test("cancelamento durante a leitura impede que uma resposta antiga ou Excel seja aceito", async () => {
  const original = globalThis.fetch;
  try {
    for (const format of [undefined, "xlsx"] as const) {
      const abort = new AbortController();
      globalThis.fetch = async () => ({
        ok: true,
        headers: new Headers({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        json: async () => { abort.abort(); return data; },
        blob: async () => { abort.abort(); return new Blob(["old-file"]); },
      }) as Response;
      await assert.rejects(requestCityVotes(selection, abort.signal, format), { name: "AbortError" });
    }
  } finally { globalThis.fetch = original; }
});

test("consulta relata falhas e só aceita um arquivo Excel com o tipo esperado", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ error: "Fonte indisponível" }, { status: 503 });
    await assert.rejects(requestCityVotes(selection, new AbortController().signal), /Fonte indisponível/);
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(requestCityVotes(selection, new AbortController().signal, "xlsx"), /Excel não foi recebido/);
    globalThis.fetch = async () => new Response("xlsx", { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
    const blob = await requestCityVotes(selection, new AbortController().signal, "xlsx");
    assert.ok(blob instanceof Blob);
  } finally { globalThis.fetch = original; }
});
