import { z } from "zod";
import type { Candidate, Municipality } from "../types/election";
import {
  historicalCandidateSchema,
  type HistoricalCandidate,
} from "./historical-election";
import {
  initialExportRows,
  mergeExportRows,
  municipalExportSchema,
  type MunicipalExportRow,
} from "./municipal-export";

const choicesSchema = z.object({
  uf: z.string(),
  year: z.literal(2022),
  round: z.literal(1),
  current: z.object({ id: z.string(), fullName: z.string() }),
  matchedId: z.string().nullable(),
  selected: historicalCandidateSchema.nullable(),
  candidates: z.array(historicalCandidateSchema.omit({ votes: true })),
});
export type ReportHistoryChoices = z.infer<typeof choicesSchema>;
async function request(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error || "Parte dos resultados está indisponível. Tente novamente.",
    );
  return body;
}
export async function reportHistoryChoices(
  uf: string,
  candidate: Candidate,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    uf,
    office: candidate.office,
    candidate: candidate.id,
  });
  const data = choicesSchema.parse(
    await request(`/api/elections/municipal/history?${params}`, signal),
  );
  if (
    data.uf !== uf ||
    data.current.id !== candidate.id ||
    (data.selected && data.selected.id !== data.matchedId)
  )
    throw new Error(
      "A identificação da candidatura de 2022 não corresponde à consulta.",
    );
  return data;
}
export async function reportHistoricalCandidate(
  uf: string,
  candidate: Candidate,
  historyId: string,
  signal: AbortSignal,
): Promise<HistoricalCandidate> {
  const params = new URLSearchParams({
    uf,
    office: candidate.office,
    candidate: candidate.id,
    history: historyId,
  });
  const data = await request(
    `/api/elections/municipal/history?${params}`,
    signal,
  );
  const selected = historicalCandidateSchema.parse(data.selected);
  if (
    data.uf !== uf ||
    data.year !== 2022 ||
    data.round !== 1 ||
    selected.id !== historyId
  )
    throw new Error("Resultado histórico de outra consulta rejeitado.");
  return selected;
}
export async function queryReportCities(input: {
  uf: string;
  candidate: Candidate;
  municipalities: Municipality[];
  signal: AbortSignal;
  onProgress: (rows: MunicipalExportRow[], done: number) => void;
}) {
  let rows = initialExportRows(input.municipalities);
  for (let i = 0; i < input.municipalities.length; i += 20) {
    input.signal.throwIfAborted();
    const codes = input.municipalities
      .slice(i, i + 20)
      .map((city) => city.code);
    const params = new URLSearchParams({
      uf: input.uf,
      office: input.candidate.office,
      candidate: input.candidate.id,
      cities: codes.join(","),
    });
    const batch = await request(
      `/api/elections/municipal/candidate?${params}`,
      input.signal,
    );
    if (
      batch.uf !== input.uf ||
      batch.candidate?.id !== input.candidate.id ||
      batch.candidate.office !== input.candidate.office
    )
      throw new Error("Resultado de outra candidatura rejeitado.");
    rows = municipalExportSchema.parse({
      uf: input.uf,
      candidate: batch.candidate,
      rows: mergeExportRows(rows, batch.rows, codes),
    }).rows;
    input.onProgress(rows, i + codes.length);
  }
  return rows;
}
