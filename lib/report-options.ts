import { z } from "zod";
import type { Municipality } from "../types/election";
import type { MunicipalExportRow } from "./municipal-export";
import type { HistoricalCandidate } from "./historical-election";
import { voteChange } from "./historical-election";

export const REPORT_TYPES = [
  {
    id: "state",
    title: "Perfil no estado",
    description: "Posição, situação oficial, cidades e regiões com mais votos.",
  },
  {
    id: "cities",
    title: "Votos por município",
    description: "Votação de 2026 nas cidades que você escolher.",
  },
  {
    id: "comparison",
    title: "Comparar 2022 e 2026",
    description: "Votos nos dois anos, diferença e variação em cada cidade.",
  },
] as const;
export type ReportType = (typeof REPORT_TYPES)[number]["id"];
export const PERSONAL_LABELS = [
  "Preparado para",
  "Região assessorada por",
  "Equipe responsável",
] as const;
export const reportPersonalizationSchema = z.object({
  name: z.string().trim().max(120),
  label: z.enum(PERSONAL_LABELS),
  title: z.string().trim().max(120),
  includeCharts: z.boolean(),
});
export type ReportPersonalization = z.infer<typeof reportPersonalizationSchema>;
export const defaultReportPersonalization = (): ReportPersonalization => ({
  name: "",
  label: "Preparado para",
  title: "",
  includeCharts: true,
});

export function reportMunicipalities(
  catalog: Municipality[],
  codes: string[],
  type: ReportType,
) {
  if (type === "state") return [...catalog];
  const selected = new Set(codes);
  if (
    !selected.size ||
    [...selected].some((code) => !catalog.some((city) => city.code === code))
  )
    throw new Error("Escolha municípios disponíveis nesta UF.");
  return catalog.filter((city) => selected.has(city.code));
}

// Only paired cities contribute to historical totals; missing votes never become zero.
export function reportComparisonTotals(
  rows: MunicipalExportRow[],
  historical: HistoricalCandidate,
) {
  const paired = rows.filter(
    (row) => row.votes !== null && Object.hasOwn(historical.votes, row.code),
  );
  const previous = paired.reduce(
    (sum, row) => sum + historical.votes[row.code],
    0,
  );
  const current = paired.reduce((sum, row) => sum + row.votes!, 0);
  return {
    paired: paired.length,
    previous: paired.length ? previous : null,
    current: paired.length ? current : null,
    ...voteChange(
      paired.length ? previous : null,
      paired.length ? current : null,
    ),
  };
}
