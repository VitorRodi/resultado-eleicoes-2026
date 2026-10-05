import { z } from "zod";
import { OFFICES } from "../types/election";
import { BRAZIL_STATES } from "./brazil-states";

export const HISTORY_SOURCE =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip";
const code = z.string().regex(/^\d{5}$/);
export const historicalCandidateSchema = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  name: z.string().min(1).max(160),
  fullName: z.string().min(1).max(160),
  number: z.string().regex(/^\d{1,10}$/),
  party: z.string().max(50),
  office: z.enum(OFFICES),
  votes: z.record(code, z.number().int().nonnegative().safe()),
});
export type HistoricalCandidate = z.infer<typeof historicalCandidateSchema>;
export type HistoricalChoice = Omit<HistoricalCandidate, "votes">;
export const historicalElectionSchema = z
  .object({
    year: z.literal(2022),
    round: z.literal(1),
    uf: z
      .string()
      .refine((uf) =>
        BRAZIL_STATES.some((state) => state.uf.toLowerCase() === uf),
      ),
    voteField: z.literal("QT_VOTOS_NOMINAIS_VALIDOS"),
    source: z.literal(HISTORY_SOURCE),
    cities: z.record(code, z.string().min(1).max(160)),
    candidates: z.array(historicalCandidateSchema).max(12000),
  })
  .superRefine((data, ctx) => {
    if (
      new Set(data.candidates.map((candidate) => candidate.id)).size !==
      data.candidates.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Identidade histórica duplicada.",
      });
    for (const candidate of data.candidates)
      if (
        Object.keys(candidate.votes).some(
          (city) => !Object.hasOwn(data.cities, city),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Votos históricos fora do catálogo municipal.",
        });
  });
export type HistoricalElection = z.infer<typeof historicalElectionSchema>;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
export function findHistoricalMatch(
  candidates: HistoricalChoice[],
  fullName: string,
) {
  const matches = candidates.filter(
    (candidate) => normalize(candidate.fullName) === normalize(fullName),
  );
  return matches.length === 1 ? matches[0].id : null;
}
export function voteChange(previous: number | null, current: number | null) {
  if (previous === null || current === null)
    return { difference: null, relative: null };
  const difference = current - previous;
  return { difference, relative: previous > 0 ? difference / previous : null };
}
