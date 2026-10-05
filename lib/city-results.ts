import { z } from "zod";
import { OFFICES } from "../types/election";
import { BRAZIL_STATES } from "./brazil-states";
export const cityResultsSchema = z.object({
  uf: z
    .string()
    .refine((uf) => BRAZIL_STATES.some((s) => s.uf.toLowerCase() === uf)),
  office: z.enum(OFFICES),
  municipality: z.object({
    code: z.string().regex(/^\d{5}$/),
    name: z.string(),
  }),
  candidates: z.array(
    z.object({
      id: z.string().regex(/^\d{1,20}$/),
      name: z.string(),
      number: z.string(),
      party: z.string(),
      votes: z.number().int().nonnegative().safe().nullable(),
    }),
  ),
  status: z.enum(["waiting", "counting", "finished", "unavailable"]),
  updatedAt: z.string().nullable(),
  stale: z.boolean(),
  verifiedSignatures: z.boolean(),
});
export type CityResults = z.infer<typeof cityResultsSchema>;
