export const PROJECTION_LABEL = "Projeção 2030";
export const PROJECTION_GROWTH_PERCENT = 20;
export const PROJECTION_RECOVERY_PERCENT = 40;
export const PROJECTION_METHOD = `Sobre os votos de 2026, some ${PROJECTION_GROWTH_PERCENT}% onde houve alta ou empate e ${PROJECTION_RECOVERY_PERCENT}% onde houve queda.`;

export function projectMunicipalVotes(
  previous: number | null,
  current: number | null,
): number | null {
  if (previous === null || current === null) return null;
  const percent = current < previous
    ? PROJECTION_RECOVERY_PERCENT
    : PROJECTION_GROWTH_PERCENT;
  return Math.round((current * (100 + percent)) / 100);
}

export function totalProjectedVotes(
  rows: readonly { code: string; votes: number | null }[],
  previousVotes: Readonly<Record<string, number>>,
): number | null {
  if (!rows.length) return null;
  let total = 0;
  for (const row of rows) {
    const projection = projectMunicipalVotes(previousVotes[row.code] ?? null, row.votes);
    if (projection === null) return null;
    total += projection;
  }
  return total;
}
