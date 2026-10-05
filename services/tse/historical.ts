import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { BRAZIL_STATES } from "../../lib/brazil-states";
import {
  historicalElectionSchema,
  findHistoricalMatch,
  type HistoricalElection,
  type HistoricalChoice,
} from "../../lib/historical-election";
import { getCandidateIdentity, UnknownMunicipalityError } from "./service";
import type { Office } from "../../types/election";

const cached = new Map<string, Promise<HistoricalElection>>();
export async function historicalElection(
  uf: string,
): Promise<HistoricalElection> {
  if (!BRAZIL_STATES.some((state) => state.uf.toLowerCase() === uf))
    throw new UnknownMunicipalityError("UF inválida.");
  if (!cached.has(uf)) {
    if (cached.size >= 4) cached.delete(cached.keys().next().value!);
    const pending = readFile(
      join(process.cwd(), "data", "elections-2022", `${uf}.json.gz`),
    )
      .then((bytes) => {
        const parsed = historicalElectionSchema.parse(
          JSON.parse(
            gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }).toString(
              "utf8",
            ),
          ),
        );
        if (parsed.uf !== uf)
          throw new Error("Histórico de outra UF rejeitado.");
        return parsed;
      })
      .catch((error) => {
        cached.delete(uf);
        throw error;
      });
    cached.set(uf, pending);
  }
  return cached.get(uf)!;
}
export async function historicalChoices(
  uf: string,
  office: Office,
  candidateId: string,
) {
  const [history, current] = await Promise.all([
    historicalElection(uf),
    getCandidateIdentity(uf, office, candidateId),
  ]);
  const candidates: HistoricalChoice[] = history.candidates
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      fullName: candidate.fullName,
      number: candidate.number,
      party: candidate.party,
      office: candidate.office,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const matchedId = findHistoricalMatch(candidates, current.fullName);
  return {
    uf,
    year: 2022,
    round: 1,
    candidates,
    matchedId,
    selected:
      history.candidates.find((candidate) => candidate.id === matchedId) ||
      null,
    current: { id: current.id, fullName: current.fullName },
  };
}
export async function historicalCandidate(uf: string, id: string) {
  if (!/^\d{1,20}$/.test(id))
    throw new UnknownMunicipalityError("Candidatura de 2022 inválida.");
  const history = await historicalElection(uf),
    candidate = history.candidates.find((candidate) => candidate.id === id);
  if (!candidate)
    throw new UnknownMunicipalityError(
      "Candidatura de 2022 não encontrada nesta UF.",
    );
  return candidate;
}
