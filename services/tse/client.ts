import { createPublicKey, verify } from 'node:crypto';

export const TSE_ORIGIN = 'https://resultados.tse.jus.br';
export const CONFIG_URL = `${TSE_ORIGIN}/oficial/comum/config/ele-c.jws`;
// Public verification key, published by the TSE, manual-verificacao-jws, Appendix B, 16/09/2026.
export const OFFICIAL_KEY = {
  kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig', key_ops: ['verify'],
  kid: 'sNbt9Q_fLS65zE1_ZLNV-XRRwPY', x: 'kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc',
};
const publicKey = createPublicKey({ key: OFFICIAL_KEY, format: 'jwk' });
export function verifyOfficialJws(content: string): unknown {
  const parts = content.trim().split('.');
  if (parts.length !== 3) throw new Error('Arquivo JWS inválido.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (header.alg !== 'EdDSA' || header.kid !== OFFICIAL_KEY.kid) throw new Error('Chave ou algoritmo não oficial.');
  if (!verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url')))
    throw new Error('Assinatura oficial inválida.');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}
export class TseHttpError extends Error {
  constructor(public status: number, public url: string) { super(`TSE HTTP ${status}`); }
}
type CachedFile = { value: unknown; expires: number; etag: string | null; modified: string | null };
const files = new Map<string, CachedFile>();
const pending = new Map<string, Promise<unknown>>();
const cooldowns = new Map<string, { until: number; status: number }>();
let activeRequests = 0;
const queue: Array<() => void> = [];
async function withRequestSlot<T>(operation:()=>Promise<T>):Promise<T> {
  if(activeRequests>=6)await new Promise<void>(resolve=>queue.push(resolve));
  else activeRequests++;
  try{return await operation();}finally{const next=queue.shift();if(next)next();else activeRequests--;}
}
function boundMap<T>(map:Map<string,T>){while(map.size>200)map.delete(map.keys().next().value!);}
export async function fetchOfficial(url: string, ttl = 12_000): Promise<unknown> {
  const target = new URL(url);
  if (target.origin !== TSE_ORIGIN || !target.pathname.startsWith('/oficial/') || !target.pathname.endsWith('.jws'))
    throw new Error('Fonte fora do ambiente oficial do TSE.');
  const existing = files.get(url);
  if (existing && existing.expires > Date.now()) return existing.value;
  const cooling = cooldowns.get(url);
  if (cooling && cooling.until > Date.now()) throw new TseHttpError(cooling.status, url);
  if (pending.has(url)) return pending.get(url)!;
  const task = withRequestSlot(async () => {
    const headers: Record<string, string> = { Accept: 'application/jose, text/plain, */*' };
    if (existing?.etag) headers['If-None-Match'] = existing.etag;
    if (existing?.modified) headers['If-Modified-Since'] = existing.modified;
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8_000), redirect: 'error' });
    if (response.status === 304 && existing) {
      existing.expires = Date.now() + ttl;
      return existing.value;
    }
    if (!response.ok) {
      // Avoid hammering missing files or extending a TSE temporary block.
      const wait = response.status === 404 ? 60_000 : [403,429].includes(response.status) ? 610_000 : 15_000;
      cooldowns.set(url, { until: Date.now() + wait, status: response.status });
      boundMap(cooldowns);
      throw new TseHttpError(response.status, url);
    }
    const value = verifyOfficialJws(await response.text());
    files.set(url, { value, expires: Date.now() + ttl, etag: response.headers.get('etag'), modified: response.headers.get('last-modified') });
    boundMap(files);
    cooldowns.delete(url);
    return value;
  });
  pending.set(url, task);
  try { return await task; } finally { pending.delete(url); }
}
