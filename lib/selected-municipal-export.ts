import type { Candidate } from "../types/election";
import { historicalCandidateSchema } from "./historical-election";
import {
  initialExportRows,
  mergeExportRows,
  municipalExportSchema,
} from "./municipal-export";

export async function selectedMunicipalComparison(selection: {
  uf: string;
  candidate: Candidate;
  codes: string[];
}) {
  const { uf, candidate } = selection;
  const codes = [...new Set(selection.codes)];
  if (
    !codes.length ||
    codes.length > 30 ||
    codes.some((code) => !/^\d{5}$/.test(code))
  )
    throw new Error("Selecione de 1 a 30 municípios para comparar.");
  const request = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      ...options,
    });
    if (!response.ok)
      throw new Error(
        "Não foi possível consultar a comparação. Tente novamente.",
      );
    return response;
  };
  const params = new URLSearchParams({
    uf,
    office: candidate.office,
    candidate: candidate.id,
  });
  const historical = await (
    await request(`/api/elections/municipal/history?${params}`)
  ).json();
  if (
    historical.uf !== uf ||
    historical.year !== 2022 ||
    historical.round !== 1 ||
    historical.current?.id !== candidate.id
  )
    throw new Error(
      "A resposta de 2022 não corresponde ao candidato selecionado.",
    );
  if (!historical.selected || !historical.matchedId)
    throw new Error(
      "Não encontramos uma candidatura única em 2022. Em Excel por cidade, confirme a candidatura de 2022 para comparar.",
    );
  const history = historicalCandidateSchema.parse(historical.selected);
  if (history.id !== historical.matchedId)
    throw new Error("A candidatura de 2022 não corresponde à seleção.");
  let data = municipalExportSchema.parse({
    uf,
    candidate,
    historyCandidateId: history.id,
    rows: initialExportRows(
      codes.map((code) => ({ code, name: `Município ${code}` })),
    ),
  });
  for (let i = 0; i < codes.length; i += 20) {
    const batchCodes = codes.slice(i, i + 20);
    params.set("cities", batchCodes.join(","));
    const batch = await (
      await request(`/api/elections/municipal/candidate?${params}`)
    ).json();
    if (
      batch.uf !== uf ||
      batch.candidate?.id !== candidate.id ||
      batch.candidate?.office !== candidate.office
    )
      throw new Error(
        "Os votos recebidos não correspondem ao candidato selecionado.",
      );
    data = municipalExportSchema.parse({
      ...data,
      rows: mergeExportRows(data.rows, batch.rows, batchCodes),
    });
  }
  const response = await request("/api/elections/municipal/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { data, blob: await response.blob() };
}
