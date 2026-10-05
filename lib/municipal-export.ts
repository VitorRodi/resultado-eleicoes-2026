import { z } from "zod";
import { OFFICES, type Municipality } from "../types/election";
import { BRAZIL_STATES } from "./brazil-states";
import { officeCode } from "./config";

export const municipalExportRowSchema = z
  .object({
    code: z.string().regex(/^\d{5}$/),
    name: z.string().min(1).max(160),
    votes: z.number().int().nonnegative().safe().nullable(),
    percentage: z.number().min(0).max(100).nullable(),
    status: z.enum([
      "waiting",
      "counting",
      "finished",
      "unavailable",
      "unqueried",
      "missing",
    ]),
    updatedAt: z.iso.datetime().nullable(),
    stale: z.boolean(),
    verifiedSignatures: z.boolean(),
    source: z.string().max(300),
  })
  .superRefine((row, ctx) => {
    if (
      row.votes !== null &&
      (!row.verifiedSignatures ||
        !["counting", "finished"].includes(row.status))
    )
      ctx.addIssue({
        code: "custom",
        message: "Votos sem resultado municipal validado.",
      });
  });
export type MunicipalExportRow = z.infer<typeof municipalExportRowSchema>;
export const municipalExportSchema = z
  .object({
    uf: z
      .string()
      .refine((uf) => BRAZIL_STATES.some((s) => s.uf.toLowerCase() === uf)),
    candidate: z.object({
      id: z.string().regex(/^\d{1,20}$/),
      name: z.string().min(1).max(160),
      number: z.string().regex(/^\d{1,10}$/),
      party: z.string().max(50),
      office: z.enum(OFFICES),
    }),
    rows: z.array(municipalExportRowSchema).min(1).max(1000),
    historyCandidateId: z
      .string()
      .regex(/^\d{1,20}$/)
      .optional(),
    includeAssociations: z.boolean().optional(),
    separateAssociations: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (new Set(data.rows.map((r) => r.code)).size !== data.rows.length)
      ctx.addIssue({ code: "custom", message: "Município duplicado." });
    const cargo = String(officeCode(data.candidate.office, data.uf)).padStart(
      4,
      "0",
    );
    for (const row of data.rows)
      if (
        row.source &&
        !new RegExp(
          `^https://resultados\\.tse\\.jus\\.br/oficial/ele2026/\\d+/dados/${data.uf}/${data.uf}${row.code}-c${cargo}-e\\d{6}-u\\.jws$`,
        ).test(row.source)
      )
        ctx.addIssue({ code: "custom", message: "Fonte municipal inválida." });
  });
export type MunicipalExport = z.infer<typeof municipalExportSchema>;
export function initialExportRows(
  cities: Municipality[],
): MunicipalExportRow[] {
  return cities.map((c) => ({
    code: c.code,
    name: c.name,
    votes: null,
    percentage: null,
    status: "unqueried",
    updatedAt: null,
    stale: false,
    verifiedSignatures: false,
    source: "",
  }));
}
export function exportRowStatus(row: MunicipalExportRow) {
  const labels = {
    waiting: "Aguardando apuração",
    counting: "Apuração em andamento",
    finished: "Totalização final",
    unavailable: "Resultado indisponível",
    unqueried: "Não consultado",
    missing: "Candidato ausente no arquivo",
  };
  return labels[row.status] + (row.stale ? " · último resultado válido" : "");
}
export function mergeExportRows(
  previous: MunicipalExportRow[],
  incoming: MunicipalExportRow[],
  requested: string[],
) {
  const allowed = new Set(requested),
    seen = new Set<string>();
  const parsed = incoming.map((row) => municipalExportRowSchema.parse(row));
  if (parsed.length !== allowed.size)
    throw new Error("Resposta municipal incompleta ou incorreta.");
  for (const row of parsed) {
    if (!allowed.has(row.code) || seen.has(row.code))
      throw new Error("Resposta municipal incompleta ou incorreta.");
    seen.add(row.code);
  }
  const updates = new Map(parsed.map((row) => [row.code, row]));
  return previous.map((row) => updates.get(row.code) || row);
}
