import { z } from 'zod';

const scalar = z.union([z.string(), z.number()]);
const cand = z.object({
  n: scalar, sqcand: scalar, nm: z.string(), nmu: z.string(), seq: scalar,
  e: z.enum(['s','n']), st: z.string(), vap: scalar, pvap: scalar,
  pvapn: scalar.optional(), dvt: z.string().optional(),
});
export const resultSchema = z.object({
  ele: scalar, t: z.enum(['1','2']), f: z.literal('o'),
  tpabr: z.enum(['br','uf','mu','zona']), cdabr: z.string(),
  dg: z.string(), hg: z.string(), idg: scalar, dt: z.string(), ht: z.string(),
  dv: z.enum(['s','n']), tf: z.enum(['s','n']), and: z.enum(['n','p','f']),
  carg: z.array(z.object({
    cd: scalar, nv: scalar,
    agr: z.array(z.object({ par: z.array(z.object({ sg: z.string(), cand: z.array(cand) })) })),
  })),
  s: z.object({ ts: scalar, st: scalar, pst: scalar, pstn: scalar.optional() }),
});
export type TseResult = z.infer<typeof resultSchema>;
export const configurationSchema = z.object({
  f: z.literal('o'),
  arq: z.array(z.object({ tp: z.string(), dir: z.string() })),
  pl: z.array(z.object({ cd: scalar, c: z.string(), dt: z.string(), e: z.array(z.object({
    cd: scalar, t: z.string(), tp: scalar,
    abr: z.array(z.object({ cd: z.string(), cp: z.array(z.object({ cd: scalar })) })),
  })) })),
});
export type TseConfiguration = z.infer<typeof configurationSchema>;
export const municipalitySchema = z.object({
  f: z.literal('o'), abr: z.array(z.object({ cd: z.string(), mu: z.array(z.object({ cd: scalar, nm: z.string() })) })),
});
