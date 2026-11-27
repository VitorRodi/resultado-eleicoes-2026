import { z } from "zod";

export const PROJECTION_LABEL = "Projeção 2030";
export const DEFAULT_PROJECTION_RATES = { growth: 20, decline: 40 } as const;
export const projectionRatesSchema = z.object({
  growth: z.number().nonnegative(),
  decline: z.number().nonnegative(),
});
export type ProjectionRates = z.infer<typeof projectionRatesSchema>;

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 20 });

export function projectionMethod(rates: ProjectionRates) {
  return `Sobre os votos de 2026, some ${percent.format(rates.growth)}% onde houve alta ou empate e ${percent.format(rates.decline)}% onde houve queda.`;
}

export function projectMunicipalVotes(
  previous: number | null,
  current: number | null,
  rates: ProjectionRates,
): number | null {
  if (previous === null || current === null) return null;
  const rate = current < previous ? rates.decline : rates.growth;
  return Math.round((current * (100 + rate)) / 100);
}

export function totalProjectedVotes(
  rows: readonly { code: string; votes: number | null }[],
  previousVotes: Readonly<Record<string, number>>,
  rates: ProjectionRates,
): number | null {
  if (!rows.length) return null;
  let total = 0;
  for (const row of rows) {
    const projection = projectMunicipalVotes(previousVotes[row.code] ?? null, row.votes, rates);
    if (projection === null) return null;
    total += projection;
  }
  return total;
}
