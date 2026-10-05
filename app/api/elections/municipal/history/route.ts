import {
  historicalChoices,
  historicalCandidate,
} from "@/services/tse/historical";
import { UnknownMunicipalityError } from "@/services/tse/service";
import { OFFICES, type Office } from "@/types/election";
import { BRAZIL_STATES } from "@/lib/brazil-states";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    uf = params.get("uf")?.toLowerCase(),
    office = params.get("office"),
    candidate = params.get("candidate");
  if (
    !uf ||
    !BRAZIL_STATES.some((state) => state.uf.toLowerCase() === uf) ||
    !OFFICES.includes(office as Office) ||
    !candidate ||
    !/^\d{1,20}$/.test(candidate)
  )
    return Response.json(
      { error: "Selecione o candidato e a UF para consultar 2022." },
      { status: 400 },
    );
  try {
    const selected = params.get("history");
    return Response.json(
      selected
        ? {
            uf,
            year: 2022,
            round: 1,
            selected: await historicalCandidate(uf, selected),
          }
        : await historicalChoices(uf, office as Office, candidate),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof UnknownMunicipalityError
            ? error.message
            : "Não foi possível consultar as candidaturas de 2022. Você pode gerar somente os votos de 2026.",
      },
      { status: error instanceof UnknownMunicipalityError ? 400 : 503 },
    );
  }
}
